use std::fmt::Debug;
use std::time::Duration;

use async_imap::{Client, Session};
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
pub async fn connect(server: &ServerConfig, username: &str, password: &str) -> Result<ImapSession> {
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

    let (session, _) = client.login_with_capabilities(username, password).await.map_err(
        |(error, _)| match error {
            async_imap::error::Error::No(message) | async_imap::error::Error::Bad(message) => {
                Error::Auth(message)
            }
            other => other.into(),
        },
    )?;
    Ok(session)
}
