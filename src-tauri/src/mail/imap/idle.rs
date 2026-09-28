//! IMAP IDLE (RFC 2177): the server pushes changes to the selected mailbox instead of the
//! client polling for them.

use std::time::Duration;

use async_imap::extensions::idle::IdleResponse;

use super::connection::ImapSession;
use crate::error::{Error, Result};

#[derive(Debug, PartialEq, Eq)]
pub enum Wake {
    /// The server reported a change (new message, expunge, flags).
    Changed,
    /// Nothing happened within the timeout; IDLE should be renewed.
    Timeout,
}

/// Idles on the selected mailbox until the server reports a change or `timeout` passes, then
/// ends IDLE and hands the session back.
pub async fn wait_for_change(
    session: ImapSession,
    timeout: Duration,
) -> Result<(ImapSession, Wake)> {
    let mut idle = session.idle();
    idle.init().await?;

    let (wait, interrupt) = idle.wait_with_timeout(timeout);
    let response = wait.await?;
    // Dropping the stop source earlier would interrupt the wait.
    drop(interrupt);

    let wake = match response {
        IdleResponse::NewData(_) => Wake::Changed,
        IdleResponse::Timeout => Wake::Timeout,
        // The stream ended: the server closed the connection.
        IdleResponse::ManualInterrupt => {
            return Err(Error::Network("IDLE connection closed".into()))
        }
    };
    let session = idle.done().await?;
    Ok((session, wake))
}
