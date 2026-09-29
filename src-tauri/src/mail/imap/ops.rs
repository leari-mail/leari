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

/// A whole-folder change (mark all read, empty, move all). It covers UIDs up to the highest one
/// the user had when asking, so mail that arrived since is left alone.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FolderPayload {
    mailbox_path: String,
    max_uid: u32,
    /// For `move_all`.
    target_path: Option<String>,
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

    /// `uids` is a UID set: `42` or `1:42`.
    async fn store(&mut self, uids: &str, add: bool, flag: &str) -> Result<()> {
        let query = format!("{}FLAGS.SILENT ({flag})", if add { "+" } else { "-" });
        let _: Vec<_> = self.session.uid_store(uids, query).await?.try_collect().await?;
        Ok(())
    }

    async fn expunge(&mut self, uids: &str) -> Result<()> {
        if self.support.uidplus {
            let _: Vec<_> = self.session.uid_expunge(uids).await?.try_collect().await?;
        } else {
            let _: Vec<_> = self.session.expunge().await?.try_collect().await?;
        }
        Ok(())
    }

    async fn move_to(&mut self, uids: &str, target_path: &str) -> Result<()> {
        if self.support.move_command {
            self.session.uid_mv(uids, target_path).await?;
        } else {
            self.session.uid_copy(uids, target_path).await?;
            self.store(uids, true, "\\Deleted").await?;
            self.expunge(uids).await?;
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
                let uid = payload.uid.to_string();
                if let Some(seen) = payload.seen {
                    self.store(&uid, seen, "\\Seen").await?;
                }
                if let Some(flagged) = payload.flagged {
                    self.store(&uid, flagged, "\\Flagged").await?;
                }
            }
            "move" => {
                let payload: MovePayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                self.select(&payload.mailbox_path).await?;
                self.move_to(&payload.uid.to_string(), &payload.target_path).await?;
            }
            "delete" => {
                let payload: DeletePayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                self.select(&payload.mailbox_path).await?;
                let uid = payload.uid.to_string();
                self.store(&uid, true, "\\Deleted").await?;
                self.expunge(&uid).await?;
            }
            "read_all" | "delete_all" | "move_all" => {
                let payload: FolderPayload =
                    serde_json::from_str(&operation.payload).map_err(invalid)?;
                if payload.max_uid == 0 {
                    return Ok(());
                }
                self.select(&payload.mailbox_path).await?;
                let uids = format!("1:{}", payload.max_uid);
                match (operation.kind.as_str(), &payload.target_path) {
                    ("read_all", _) => self.store(&uids, true, "\\Seen").await?,
                    ("delete_all", _) => {
                        self.store(&uids, true, "\\Deleted").await?;
                        self.expunge(&uids).await?;
                    }
                    (_, Some(target_path)) => self.move_to(&uids, target_path).await?,
                    (_, None) => return Err(Error::Other("move_all without a target".into())),
                }
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
