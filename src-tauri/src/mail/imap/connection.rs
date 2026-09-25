use std::fmt::Debug;
use std::time::Duration;

use async_imap::{Client, Session};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_native_tls::{native_tls, TlsConnector};

use crate::error::{Error, Result};
use crate::mail::account::{Security, ServerConfig};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);

pub trait Stream: AsyncRead + AsyncWrite + Unpin + Send + Debug {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send + Debug> Stream for T {}

pub type ImapSession = Session<Box<dyn Stream>>;

/// How to log in: a password, or an OAuth access token (SASL XOAUTH2, used by Gmail and Outlook).
#[derive(Clone, Copy)]
pub enum Auth<'a> {
    Password(&'a str),
    OAuth2(&'a str),
}

/// The XOAUTH2 credentials go in the command itself (SASL-IR, RFC 4959, supported by Gmail
/// and Outlook). A continuation from the server is an error report: answering it with an
/// empty response ends the exchange so the server returns the tagged failure.
struct XOAuth2Failure;

impl async_imap::Authenticator for XOAuth2Failure {
    type Response = &'static str;

    fn process(&mut self, _challenge: &[u8]) -> &'static str {
        ""
    }
}

pub fn xoauth2_payload(username: &str, access_token: &str) -> String {
    format!("user={username}\x01auth=Bearer {access_token}\x01\x01")
}

async fn tls_wrap(host: &str, tcp: TcpStream) -> Result<Box<dyn Stream>> {
    let connector = TlsConnector::from(native_tls::TlsConnector::new()?);
    let tls = timeout(CONNECT_TIMEOUT, connector.connect(host, tcp)).await??;
    Ok(Box::new(tls))
}

async fn read_greeting<T: Stream>(client: &mut Client<T>) -> Result<()> {
    match timeout(CONNECT_TIMEOUT, client.read_response()).await?? {
        Some(_) => Ok(()),
        None => Err(Error::Network("server closed the connection".into())),
    }
}

/// Opens a connection (implicit TLS, STARTTLS or plain) and logs in.
pub async fn connect(server: &ServerConfig, username: &str, auth: Auth<'_>) -> Result<ImapSession> {
    let tcp =
        timeout(CONNECT_TIMEOUT, TcpStream::connect((server.host.as_str(), server.port))).await??;

    let client: Client<Box<dyn Stream>> = match server.security {
        Security::Ssl => {
            let mut client = Client::new(tls_wrap(&server.host, tcp).await?);
            read_greeting(&mut client).await?;
            client
        }
        Security::Starttls => {
            let mut plain = Client::new(tcp);
            read_greeting(&mut plain).await?;
            plain.run_command_and_check_ok("STARTTLS", None).await?;
            Client::new(tls_wrap(&server.host, plain.into_inner()).await?)
        }
        Security::None => {
            let mut client = Client::new(Box::new(tcp) as Box<dyn Stream>);
            read_greeting(&mut client).await?;
            client
        }
    };

    let result = match auth {
        Auth::Password(password) => {
            client.login_with_capabilities(username, password).await.map(|(session, _)| session)
        }
        Auth::OAuth2(token) => {
            let initial_response = STANDARD.encode(xoauth2_payload(username, token));
            client.authenticate(format!("XOAUTH2 {initial_response}"), XOAuth2Failure).await
        }
    };
    let session = result.map_err(|(error, _)| match error {
        async_imap::error::Error::No(message) | async_imap::error::Error::Bad(message) => {
            Error::Auth(message)
        }
        other => other.into(),
    })?;
    Ok(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_xoauth2_payload() {
        // Example from Google's XOAUTH2 documentation.
        assert_eq!(
            xoauth2_payload("someuser@example.com", "ya29.vF9dft4qmTc2Nvb3RlckBhdHRhdmlzdGEuY29tCg"),
            "user=someuser@example.com\x01auth=Bearer ya29.vF9dft4qmTc2Nvb3RlckBhdHRhdmlzdGEuY29tCg\x01\x01"
        );
    }
}
