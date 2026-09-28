use std::collections::HashSet;

use sqlx::SqlitePool;

use super::client::Pop3;
use crate::db::new_id;
use crate::error::{Error, Result};
use crate::mail::account::Account;
use crate::mail::parse;
use crate::mail::store::{self, Flags, InsertedMessage, NewMessage};

/// How many of the most recent messages the first sync downloads.
const INITIAL_WINDOW: usize = 200;
const BATCH_SIZE: usize = 25;
/// Bigger messages only get their headers downloaded.
const MAX_FULL_FETCH_SIZE: u64 = 15 * 1024 * 1024;

#[derive(sqlx::FromRow)]
struct Inbox {
    id: String,
    /// Set to 1 after the first sync (POP3 has no UIDVALIDITY; the column marks "synced").
    uid_validity: Option<i64>,
}

async fn inbox(db: &SqlitePool, account_id: &str) -> Result<Inbox> {
    let existing: Option<Inbox> = sqlx::query_as(
        "SELECT id, uid_validity FROM mailboxes WHERE account_id = ? AND role = 'inbox' LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(db)
    .await?;
    if let Some(inbox) = existing {
        return Ok(inbox);
    }
    let id = new_id();
    sqlx::query(
        "INSERT INTO mailboxes (id, account_id, path, name, role, sort_order) VALUES (?, ?, 'INBOX', 'Inbox', 'inbox', 0)",
    )
    .bind(&id)
    .bind(account_id)
    .execute(db)
    .await?;
    Ok(Inbox { id, uid_validity: None })
}

/// Downloads new messages into the local inbox. Returns the ones to announce (never on the
/// first sync, which downloads existing mail).
pub async fn sync_account(
    db: &SqlitePool,
    account: &Account,
    password: &str,
    on_progress: &(dyn Fn() + Send + Sync),
) -> Result<Vec<InsertedMessage>> {
    let inbox = inbox(db, &account.id).await?;
    let first_sync = inbox.uid_validity.is_none();
    let known: HashSet<String> = sqlx::query_scalar::<_, String>(
        "SELECT remote_id FROM messages WHERE mailbox_id = ? AND remote_id IS NOT NULL",
    )
    .bind(&inbox.id)
    .fetch_all(db)
    .await?
    .into_iter()
    .collect();

    let mut pop = Pop3::connect(&account.incoming, &account.username, password).await?;
    let listing = pop.uidl().await?;
    let sizes = pop.list().await?;

    // Message numbers grow with arrival: newest first.
    let mut new: Vec<(u32, String)> =
        listing.iter().filter(|(_, uidl)| !known.contains(uidl)).cloned().collect();
    new.sort_by_key(|(number, _)| std::cmp::Reverse(*number));
    if first_sync {
        new.truncate(INITIAL_WINDOW);
    }

    let mut arrived = Vec::new();
    for batch in new.chunks(BATCH_SIZE) {
        let mut rows = Vec::with_capacity(batch.len());
        for (number, uidl) in batch {
            let size = sizes.get(number).copied();
            let raw = if size.unwrap_or(0) > MAX_FULL_FETCH_SIZE {
                pop.top(*number, 0).await?
            } else {
                pop.retr(*number).await?
            };
            rows.push(NewMessage {
                account_id: &account.id,
                mailbox_id: &inbox.id,
                uid: None,
                remote_id: Some(uidl.clone()),
                size: size.and_then(|size| u32::try_from(size).ok()),
                internal_date_ms: None,
                flags: Flags { seen: false, flagged: false, draft: false },
                parsed: parse::parse(&raw).unwrap_or_default(),
            });
        }
        let inserted = store::insert_messages(db, rows).await?;
        if !first_sync {
            arrived.extend(inserted);
        }
        on_progress();
    }

    sqlx::query("UPDATE mailboxes SET uid_validity = 1, total_count = ? WHERE id = ?")
        .bind(listing.len() as i64)
        .bind(&inbox.id)
        .execute(db)
        .await?;
    pop.quit().await;
    Ok(arrived)
}

/// Downloads one message again (for attachments), by its UIDL.
pub async fn fetch_raw(account: &Account, password: &str, uidl: &str) -> Result<Vec<u8>> {
    let mut pop = Pop3::connect(&account.incoming, &account.username, password).await?;
    let number = pop
        .uidl()
        .await?
        .into_iter()
        .find_map(|(number, id)| (id == uidl).then_some(number))
        .ok_or_else(|| Error::Other("message no longer exists on the server".into()))?;
    let raw = pop.retr(number).await?;
    pop.quit().await;
    Ok(raw)
}
