//! Pushes local changes queued in `pending_operations` (written by the frontend) to the server.

use futures::TryStreamExt;
use serde::Deserialize;
use sqlx::SqlitePool;

use super::connection::ImapSession;
use crate::error::{Error, Result};

/// After this many failures an operation is dropped so it cannot block the queue forever.
const MAX_ATTEMPTS: i64 = 5;

#[derive(Debug, Clone, Copy)]
pub struct ServerSupport {
    pub move_command: bool,
    pub uidplus: bool,
}

#[derive(sqlx::FromRow)]
struct OperationRow {
    id: String,
    message_id: Option<String>,
    kind: String,
    payload: String,
    attempts: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FlagsPayload {
    mailbox_path: String,
    uid: u32,
    seen: Option<bool>,
    flagged: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MovePayload {
    mailbox_path: String,
    uid: u32,
    target_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeletePayload {
    mailbox_path: String,
    uid: u32,
}

struct Pusher<'a> {
    session: &'a mut ImapSession,
    selected: Option<String>,
    support: ServerSupport,
}

impl Pusher<'_> {
    async fn select(&mut self, path: &str) -> Result<()> {
        if self.selected.as_deref() != Some(path) {
            self.session.select(path).await?;
            self.selected = Some(path.to_owned());
        }
        Ok(())
    }

    async fn store(&mut self, uid: u32, add: bool, flag: &str) -> Result<()> {
        let query = format!("{}FLAGS.SILENT ({flag})", if add { "+" } else { "-" });
        let _: Vec<_> = self.session.uid_store(uid.to_string(), query).await?.try_collect().await?;
        Ok(())
    }

    async fn expunge(&mut self, uid: u32) -> Result<()> {
        if self.support.uidplus {
            let _: Vec<_> = self.session.uid_expunge(uid.to_string()).await?.try_collect().await?;
        } else {
            let _: Vec<_> = self.session.expunge().await?.try_collect().await?;
        }
        Ok(())
    }

    async fn apply(&mut self, operation: &OperationRow) -> Result<()> {
        let invalid = |error: serde_json::Error| Error::Other(format!("invalid payload: {error}"));

        match operation.kind.as_str() {
            "flags" => {
                let payload: FlagsPayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                self.select(&payload.mailbox_path).await?;
                if let Some(seen) = payload.seen {
                    self.store(payload.uid, seen, "\\Seen").await?;
                }
                if let Some(flagged) = payload.flagged {
                    self.store(payload.uid, flagged, "\\Flagged").await?;
                }
            }
            "move" => {
                let payload: MovePayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                self.select(&payload.mailbox_path).await?;
                let uid = payload.uid.to_string();
                if self.support.move_command {
                    self.session.uid_mv(&uid, &payload.target_path).await?;
                } else {
                    self.session.uid_copy(&uid, &payload.target_path).await?;
                    self.store(payload.uid, true, "\\Deleted").await?;
                    self.expunge(payload.uid).await?;
                }
            }
            "delete" => {
                let payload: DeletePayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                self.select(&payload.mailbox_path).await?;
                self.store(payload.uid, true, "\\Deleted").await?;
                self.expunge(payload.uid).await?;
            }
            other => return Err(Error::Other(format!("unknown operation kind {other}"))),
        }
        Ok(())
    }
}

pub async fn push(
    db: &SqlitePool,
    session: &mut ImapSession,
    account_id: &str,
    support: ServerSupport,
) -> Result<()> {
    let operations: Vec<OperationRow> = sqlx::query_as(
        "SELECT id, message_id, kind, payload, attempts FROM pending_operations \
         WHERE account_id = ? ORDER BY created_at",
    )
    .bind(account_id)
    .fetch_all(db)
    .await?;

    let mut pusher = Pusher { session, selected: None, support };

    for operation in operations {
        match pusher.apply(&operation).await {
            Ok(()) => {
                sqlx::query("DELETE FROM pending_operations WHERE id = ?")
                    .bind(&operation.id)
                    .execute(db)
                    .await?;
                // The moved copy gets a new UID in the target folder and is pulled again there.
                if operation.kind == "move" {
                    if let Some(message_id) = &operation.message_id {
                        sqlx::query("DELETE FROM messages WHERE id = ? AND uid IS NULL")
                            .bind(message_id)
                            .execute(db)
                            .await?;
                    }
                }
            }
            // Connection problems: keep everything queued and retry on the next sync.
            Err(error @ Error::Network(_)) => return Err(error),
            Err(error) => {
                log::warn!("pending operation {} failed: {error}", operation.id);
                if operation.attempts + 1 >= MAX_ATTEMPTS {
                    sqlx::query("DELETE FROM pending_operations WHERE id = ?")
                        .bind(&operation.id)
                        .execute(db)
                        .await?;
                } else {
                    sqlx::query("UPDATE pending_operations SET attempts = attempts + 1, last_error = ? WHERE id = ?")
                        .bind(error.to_string())
                        .bind(&operation.id)
                        .execute(db)
                        .await?;
                }
                // A failed SELECT leaves no mailbox selected.
                pusher.selected = None;
            }
        }
    }
    Ok(())
}
