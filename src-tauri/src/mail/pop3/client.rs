//! Minimal POP3 client (RFC 1939, STLS from RFC 2595): enough to list and download messages.

use std::collections::HashMap;
use std::time::Duration;

use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::time::timeout;

use crate::error::{Error, Result};
use crate::mail::account::{Security, ServerConfig};
use crate::mail::net::{self, Stream};

const READ_TIMEOUT: Duration = Duration::from_secs(60);

pub struct Pop3 {
    stream: BufReader<Box<dyn Stream>>,
}

async fn read_line<R: AsyncBufRead + Unpin>(reader: &mut R) -> Result<Vec<u8>> {
    let mut line = Vec::new();
    let read = timeout(READ_TIMEOUT, reader.read_until(b'\n', &mut line)).await??;
    if read == 0 {
        return Err(Error::Network("POP3 server closed the connection".into()));
    }
    Ok(line)
}

/// Reads a status line: `+OK …` returns the text after it, `-ERR …` is an error.
async fn read_status<R: AsyncBufRead + Unpin>(reader: &mut R) -> Result<String> {
    let line = read_line(reader).await?;
    let text = String::from_utf8_lossy(&line).trim_end().to_owned();
    if let Some(rest) = text.strip_prefix("+OK") {
        Ok(rest.trim().to_owned())
    } else {
        Err(Error::Protocol(text.strip_prefix("-ERR").unwrap_or(&text).trim().to_owned()))
    }
}

async fn send<S: AsyncBufRead + AsyncWrite + Unpin>(
    stream: &mut S,
    command: &str,
) -> Result<String> {
    stream.write_all(format!("{command}\r\n").as_bytes()).await?;
    stream.flush().await?;
    read_status(stream).await
}

/// Removes the byte-stuffing of a multi-line response line (RFC 1939 §3).
fn unstuff(line: &[u8]) -> &[u8] {
    if line.starts_with(b"..") {
        &line[1..]
    } else {
        line
    }
}

fn is_terminator(line: &[u8]) -> bool {
    line == b".\r\n" || line == b".\n"
}

/// `n value` lines of UIDL / LIST responses.
pub fn parse_listing(body: &[u8]) -> Vec<(u32, String)> {
    String::from_utf8_lossy(body)
        .lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            Some((parts.next()?.parse().ok()?, parts.next()?.to_owned()))
        })
        .collect()
}

impl Pop3 {
    pub async fn connect(server: &ServerConfig, username: &str, password: &str) -> Result<Self> {
        let tcp = net::tcp(&server.host, server.port).await?;
        let stream: Box<dyn Stream> = match server.security {
            Security::Ssl => net::tls(&server.host, tcp).await?,
            Security::None => Box::new(tcp),
            Security::Starttls => {
                let mut plain = BufReader::new(tcp);
                read_status(&mut plain).await?;
                send(&mut plain, "STLS").await?;
                return Self::login(
                    BufReader::new(net::tls(&server.host, plain.into_inner()).await?),
                    false,
                    username,
                    password,
                )
                .await;
            }
        };
        Self::login(BufReader::new(stream), true, username, password).await
    }

    async fn login(
        mut stream: BufReader<Box<dyn Stream>>,
        expect_greeting: bool,
        username: &str,
        password: &str,
    ) -> Result<Self> {
        if expect_greeting {
            read_status(&mut stream).await?;
        }
        let mut pop3 = Pop3 { stream };
        let login = async {
            pop3.command(&format!("USER {username}")).await?;
            pop3.command(&format!("PASS {password}")).await
        };
        match login.await {
            Ok(_) => Ok(pop3),
            Err(Error::Protocol(message)) => Err(Error::Auth(message)),
            Err(error) => Err(error),
        }
    }

    async fn command(&mut self, command: &str) -> Result<String> {
        send(&mut self.stream, command).await
    }

    /// Body of a multi-line response, un-stuffed, with original line endings.
    async fn multiline(&mut self) -> Result<Vec<u8>> {
        let mut body = Vec::new();
        loop {
            let line = read_line(&mut self.stream).await?;
            if is_terminator(&line) {
                return Ok(body);
            }
            body.extend_from_slice(unstuff(&line));
        }
    }

    /// Unique ids of the messages on the server, by message number.
    pub async fn uidl(&mut self) -> Result<Vec<(u32, String)>> {
        self.command("UIDL").await?;
        Ok(parse_listing(&self.multiline().await?))
    }

    /// Message sizes in bytes, by message number.
    pub async fn list(&mut self) -> Result<HashMap<u32, u64>> {
        self.command("LIST").await?;
        Ok(parse_listing(&self.multiline().await?)
            .into_iter()
            .filter_map(|(number, size)| Some((number, size.parse().ok()?)))
            .collect())
    }

    /// The full message.
    pub async fn retr(&mut self, number: u32) -> Result<Vec<u8>> {
        self.command(&format!("RETR {number}")).await?;
        self.multiline().await
    }

    /// Headers plus the first `lines` lines of the body.
    pub async fn top(&mut self, number: u32, lines: u32) -> Result<Vec<u8>> {
        self.command(&format!("TOP {number} {lines}")).await?;
        self.multiline().await
    }

    pub async fn quit(mut self) {
        let _ = self.command("QUIT").await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_uidl_and_list_responses() {
        let body = b"1 whqtswO00WBw418f9t5JxYwZ\r\n2 QhdPYR:00WBw1Ph7x7\r\n";
        assert_eq!(
            parse_listing(body),
            [(1, "whqtswO00WBw418f9t5JxYwZ".to_owned()), (2, "QhdPYR:00WBw1Ph7x7".to_owned())]
        );
        assert!(parse_listing(b"garbage\r\n").is_empty());
    }

    #[tokio::test]
    async fn reads_multiline_bodies_byte_exactly() {
        let response: &[u8] =
            b"+OK message follows\r\nSubject: x\r\n\r\n..leading dot\r\n.\r\n+OK next\r\n";
        let mut reader = BufReader::new(response);
        assert_eq!(read_status(&mut reader).await.unwrap(), "message follows");

        let mut body = Vec::new();
        loop {
            let line = read_line(&mut reader).await.unwrap();
            if is_terminator(&line) {
                break;
            }
            body.extend_from_slice(unstuff(&line));
        }
        assert_eq!(body, b"Subject: x\r\n\r\n.leading dot\r\n");
        assert_eq!(read_status(&mut reader).await.unwrap(), "next");
    }

    #[tokio::test]
    async fn err_status_is_an_error() {
        let mut reader = BufReader::new(&b"-ERR invalid password\r\n"[..]);
        assert!(
            matches!(read_status(&mut reader).await, Err(Error::Protocol(m)) if m == "invalid password")
        );
    }
}
