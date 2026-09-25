use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

pub type Result<T, E = Error> = std::result::Result<T, E>;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Auth(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    Unsupported(String),
    #[error("{0}")]
    Protocol(String),
    #[error("database: {0}")]
    Database(#[from] sqlx::Error),
    #[error("keychain: {0}")]
    Keychain(#[from] keyring::Error),
    /// Bad user input (e.g. an unparsable recipient); the message is the offending value.
    #[error("{0}")]
    Invalid(String),
    #[error("cancelled")]
    Cancelled,
    #[error("{0}")]
    Other(String),
}

impl Error {
    /// Stable category the UI uses to pick a message / action.
    pub fn kind(&self) -> &'static str {
        match self {
            Error::Auth(_) => "auth",
            Error::Network(_) => "network",
            Error::Unsupported(_) => "unsupported",
            Error::Protocol(_) => "protocol",
            Error::Cancelled => "cancelled",
            Error::Invalid(_) => "invalid",
            Error::Database(_) | Error::Keychain(_) | Error::Other(_) => "other",
        }
    }
}

/// Wrapped library errors can't be cloned; they keep their message as `Other`.
impl Clone for Error {
    fn clone(&self) -> Self {
        match self {
            Error::Auth(message) => Error::Auth(message.clone()),
            Error::Network(message) => Error::Network(message.clone()),
            Error::Unsupported(message) => Error::Unsupported(message.clone()),
            Error::Protocol(message) => Error::Protocol(message.clone()),
            Error::Cancelled => Error::Cancelled,
            Error::Invalid(message) => Error::Invalid(message.clone()),
            other => Error::Other(other.to_string()),
        }
    }
}

impl From<async_imap::error::Error> for Error {
    fn from(error: async_imap::error::Error) -> Self {
        use async_imap::error::Error as Imap;
        match error {
            Imap::Io(io) => Error::Network(io.to_string()),
            Imap::ConnectionLost => Error::Network("connection lost".into()),
            other => Error::Protocol(other.to_string()),
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Error::Network(error.to_string())
    }
}

impl From<tokio_native_tls::native_tls::Error> for Error {
    fn from(error: tokio_native_tls::native_tls::Error) -> Self {
        Error::Network(format!("TLS: {error}"))
    }
}

impl From<tokio::time::error::Elapsed> for Error {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        Error::Network("timed out".into())
    }
}

/// Serialized as `{ kind, message }` for the frontend.
impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("Error", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}
