//! Network plumbing shared by the IMAP and POP3 clients: TCP with timeouts and TLS.

use std::fmt::Debug;
use std::time::Duration;

use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_native_tls::{native_tls, TlsConnector};

use crate::error::Result;

pub const CONNECT_TIMEOUT: Duration = Duration::from_secs(30);

/// Any byte stream a mail protocol runs over (plain TCP or TLS).
pub trait Stream: AsyncRead + AsyncWrite + Unpin + Send + Debug {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send + Debug> Stream for T {}

pub async fn tcp(host: &str, port: u16) -> Result<TcpStream> {
    Ok(timeout(CONNECT_TIMEOUT, TcpStream::connect((host, port))).await??)
}

/// Upgrades a TCP connection to TLS, verifying the certificate against `host`.
pub async fn tls<S: AsyncRead + AsyncWrite + Unpin + Send + Debug + 'static>(
    host: &str,
    stream: S,
) -> Result<Box<dyn Stream>> {
    let connector = TlsConnector::from(native_tls::TlsConnector::new()?);
    let tls = timeout(CONNECT_TIMEOUT, connector.connect(host, stream)).await??;
    Ok(Box::new(tls))
}
