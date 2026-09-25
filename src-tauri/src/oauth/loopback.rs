//! Loopback redirect receiver (RFC 8252 §7.3): a one-shot local HTTP server that catches the
//! provider's redirect with the authorization code.

use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::time::timeout;

use crate::error::{Error, Result};

const MAX_REQUEST: usize = 16 * 1024;

pub struct Loopback {
    v4: TcpListener,
    /// `localhost` may resolve to ::1 first in the browser, so listen there too when possible.
    v6: Option<TcpListener>,
    pub port: u16,
}

pub async fn bind() -> Result<Loopback> {
    let v4 = TcpListener::bind(("127.0.0.1", 0)).await?;
    let port = v4.local_addr()?.port();
    let v6 = TcpListener::bind(("::1", port)).await.ok();
    Ok(Loopback { v4, v6, port })
}

/// What the user sees in the browser tab after signing in.
pub struct Page {
    pub success_title: &'static str,
    pub success_text: &'static str,
    pub failure_title: &'static str,
}

impl Page {
    pub fn for_language(language: &str) -> Self {
        if language.to_lowercase().starts_with("pt") {
            Page {
                success_title: "Tudo certo!",
                success_text: "Você entrou no leari. Pode fechar esta aba.",
                failure_title: "Não foi possível entrar",
            }
        } else {
            Page {
                success_title: "You're signed in",
                success_text: "Leari is connected. You can close this tab.",
                failure_title: "Sign-in failed",
            }
        }
    }
}

fn html(title: &str, text: &str) -> String {
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>Leari</title><style>\
         body{{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;\
         font:15px/1.5 -apple-system,system-ui,sans-serif;background:#1b2a72;color:#fff}}\
         main{{text-align:center;max-width:26rem;padding:2rem}}h1{{font-size:1.4rem;margin:0 0 .5rem}}\
         p{{opacity:.85;margin:0}}</style></head><body><main><h1>{}</h1><p>{}</p></main></body></html>",
        escape(title),
        escape(text)
    )
}

fn escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

async fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Connection: close\r\nCache-Control: no-store\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

/// Reads the request line (`GET /path?query HTTP/1.1`) and returns the path with query.
async fn read_target(stream: &mut TcpStream) -> Option<String> {
    let mut buffer = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    while !buffer.windows(4).any(|window| window == b"\r\n\r\n") && buffer.len() < MAX_REQUEST {
        let read = timeout(Duration::from_secs(10), stream.read(&mut chunk)).await.ok()?.ok()?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let request = String::from_utf8_lossy(&buffer);
    let mut parts = request.lines().next()?.split_whitespace();
    (parts.next()? == "GET").then(|| parts.next().map(str::to_owned))?
}

pub enum Callback {
    Code(String),
    /// Not the redirect (e.g. `/favicon.ico`): keep waiting.
    Ignore,
}

/// Interprets the redirect target: `?code=…&state=…` or `?error=…`.
pub fn parse_callback(target: &str, expected_state: &str) -> Result<Callback> {
    let url = reqwest::Url::parse(&format!("http://localhost{target}"))
        .map_err(|error| Error::Other(error.to_string()))?;
    let param = |name: &str| {
        url.query_pairs().find(|(key, _)| key == name).map(|(_, value)| value.into_owned())
    };

    if let Some(error) = param("error") {
        let description = param("error_description").unwrap_or_default();
        return Err(Error::Auth(format!("{error} {description}").trim().to_owned()));
    }
    let Some(code) = param("code") else { return Ok(Callback::Ignore) };
    if param("state").as_deref() != Some(expected_state) {
        return Err(Error::Auth("sign-in response did not match the request".into()));
    }
    Ok(Callback::Code(code))
}

impl Loopback {
    async fn accept(&self) -> std::io::Result<TcpStream> {
        match &self.v6 {
            Some(v6) => tokio::select! {
                accepted = self.v4.accept() => accepted.map(|(stream, _)| stream),
                accepted = v6.accept() => accepted.map(|(stream, _)| stream),
            },
            None => self.v4.accept().await.map(|(stream, _)| stream),
        }
    }

    /// Waits for the provider's redirect and returns the authorization code.
    pub async fn wait_for_code(&self, expected_state: &str, page: &Page) -> Result<String> {
        loop {
            let mut stream = self.accept().await?;
            let Some(target) = read_target(&mut stream).await else {
                respond(&mut stream, "400 Bad Request", "").await;
                continue;
            };
            match parse_callback(&target, expected_state) {
                Ok(Callback::Code(code)) => {
                    respond(&mut stream, "200 OK", &html(page.success_title, page.success_text))
                        .await;
                    return Ok(code);
                }
                Ok(Callback::Ignore) => respond(&mut stream, "404 Not Found", "").await,
                Err(error) => {
                    respond(&mut stream, "200 OK", &html(page.failure_title, &error.to_string()))
                        .await;
                    return Err(error);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_code_when_state_matches() {
        let result = parse_callback("/?code=4%2F0Ab&state=abc&scope=email", "abc").unwrap();
        assert!(matches!(result, Callback::Code(code) if code == "4/0Ab"));
    }

    #[test]
    fn rejects_state_mismatch_and_errors() {
        assert!(parse_callback("/?code=x&state=evil", "abc").is_err());
        assert!(matches!(
            parse_callback("/?error=access_denied&state=abc", "abc"),
            Err(Error::Auth(message)) if message.contains("access_denied")
        ));
    }

    #[test]
    fn ignores_unrelated_requests() {
        assert!(matches!(parse_callback("/favicon.ico", "abc").unwrap(), Callback::Ignore));
    }

    #[tokio::test]
    async fn serves_one_redirect() {
        let loopback = bind().await.unwrap();
        let port = loopback.port;
        let page = Page::for_language("en");
        let browser = tokio::spawn(async move {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
            stream
                .write_all(b"GET /?code=abc123&state=s1 HTTP/1.1\r\nHost: x\r\n\r\n")
                .await
                .unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).await.unwrap();
            response
        });
        let code = loopback.wait_for_code("s1", &page).await.unwrap();
        assert_eq!(code, "abc123");
        assert!(browser.await.unwrap().contains("You're signed in"));
    }
}
