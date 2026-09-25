//! Protocol-agnostic persistence of synced data into the frontend-owned schema
//! (see src/db/schema). Timestamps are stored in milliseconds, booleans as 0/1.

use std::collections::{HashMap, HashSet};

use sqlx::{Sqlite, SqlitePool, Transaction};

use super::parse::{MailAddress, ParsedMessage};
use crate::db::new_id;
use crate::error::Result;

/// A folder as reported by the server.
#[derive(Debug, Clone)]
pub struct FolderInfo {
    pub path: String,
    pub name: String,
    pub delimiter: Option<String>,
    pub role: &'static str,
    pub sort_order: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LocalMailbox {
    pub id: String,
    pub path: String,
    pub role: String,
    pub uid_validity: Option<i64>,
}

#[derive(Debug, Clone, Copy)]
pub struct Flags {
    pub seen: bool,
    pub flagged: bool,
    pub draft: bool,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct KnownMessage {
    pub id: String,
    pub uid: i64,
    pub is_read: bool,
    pub is_starred: bool,
}

/// Aligns local mailboxes with the server's folder list:
/// same path → update; same special role under another path → re-point (keeps the id);
/// otherwise insert. Local mailboxes missing on the server are removed.
pub async fn reconcile_mailboxes(
    db: &SqlitePool,
    account_id: &str,
    folders: &[FolderInfo],
) -> Result<Vec<LocalMailbox>> {
    let mut tx = db.begin().await?;
    let mut local: Vec<LocalMailbox> =
        sqlx::query_as("SELECT id, path, role, uid_validity FROM mailboxes WHERE account_id = ?")
            .bind(account_id)
            .fetch_all(&mut *tx)
            .await?;

    let remote_paths: HashSet<&str> = folders.iter().map(|folder| folder.path.as_str()).collect();
    let mut kept: HashSet<String> = HashSet::new();

    for folder in folders {
        let by_path = local.iter().position(|mailbox| mailbox.path == folder.path);
        let by_role = || {
            local.iter().position(|mailbox| {
                folder.role != "custom"
                    && mailbox.role == folder.role
                    && !remote_paths.contains(mailbox.path.as_str())
                    && !kept.contains(&mailbox.id)
            })
        };

        if let Some(index) = by_path.or_else(by_role) {
            let mailbox = &mut local[index];
            sqlx::query(
                "UPDATE mailboxes SET path = ?, name = ?, role = ?, delimiter = ?, sort_order = ? WHERE id = ?",
            )
            .bind(&folder.path)
            .bind(&folder.name)
            .bind(folder.role)
            .bind(&folder.delimiter)
            .bind(folder.sort_order)
            .bind(&mailbox.id)
            .execute(&mut *tx)
            .await?;
            mailbox.path = folder.path.clone();
            mailbox.role = folder.role.to_owned();
            kept.insert(mailbox.id.clone());
        } else {
            let id = new_id();
            sqlx::query(
                "INSERT INTO mailboxes (id, account_id, path, name, role, delimiter, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&id)
            .bind(account_id)
            .bind(&folder.path)
            .bind(&folder.name)
            .bind(folder.role)
            .bind(&folder.delimiter)
            .bind(folder.sort_order)
            .execute(&mut *tx)
            .await?;
            kept.insert(id.clone());
            local.push(LocalMailbox {
                id,
                path: folder.path.clone(),
                role: folder.role.to_owned(),
                uid_validity: None,
            });
        }
    }

    for mailbox in local.iter().filter(|mailbox| !kept.contains(&mailbox.id)) {
        sqlx::query("DELETE FROM mailboxes WHERE id = ?")
            .bind(&mailbox.id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    local.retain(|mailbox| kept.contains(&mailbox.id));
    Ok(local)
}

/// Drops every synced message of a mailbox (e.g. after a UIDVALIDITY change) and stores the new value.
pub async fn reset_mailbox(
    db: &SqlitePool,
    mailbox_id: &str,
    uid_validity: Option<u32>,
) -> Result<()> {
    let mut tx = db.begin().await?;
    sqlx::query("DELETE FROM messages WHERE mailbox_id = ? AND uid IS NOT NULL")
        .bind(mailbox_id)
        .execute(&mut *tx)
        .await?;
    sqlx::query("UPDATE mailboxes SET uid_validity = ? WHERE id = ?")
        .bind(uid_validity.map(i64::from))
        .bind(mailbox_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn set_mailbox_total(db: &SqlitePool, mailbox_id: &str, total: u32) -> Result<()> {
    sqlx::query("UPDATE mailboxes SET total_count = ? WHERE id = ?")
        .bind(i64::from(total))
        .bind(mailbox_id)
        .execute(db)
        .await?;
    Ok(())
}

pub async fn known_messages(
    db: &SqlitePool,
    mailbox_id: &str,
) -> Result<HashMap<u32, KnownMessage>> {
    let rows: Vec<KnownMessage> = sqlx::query_as(
        "SELECT id, uid, is_read, is_starred FROM messages WHERE mailbox_id = ? AND uid IS NOT NULL",
    )
    .bind(mailbox_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(|row| (row.uid as u32, row)).collect())
}

/// Messages with local changes not yet pushed; the server's state must not overwrite them.
pub async fn pending_message_ids(db: &SqlitePool, account_id: &str) -> Result<HashSet<String>> {
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT message_id FROM pending_operations WHERE account_id = ? AND message_id IS NOT NULL",
    )
    .bind(account_id)
    .fetch_all(db)
    .await?;
    Ok(ids.into_iter().collect())
}

pub async fn delete_messages(db: &SqlitePool, ids: &[String]) -> Result<()> {
    let mut tx = db.begin().await?;
    for id in ids {
        sqlx::query("DELETE FROM messages WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn update_flags(db: &SqlitePool, updates: &[(String, Flags)]) -> Result<()> {
    let mut tx = db.begin().await?;
    for (id, flags) in updates {
        sqlx::query("UPDATE messages SET is_read = ?, is_starred = ? WHERE id = ?")
            .bind(flags.seen)
            .bind(flags.flagged)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub struct NewMessage<'a> {
    pub account_id: &'a str,
    pub mailbox_id: &'a str,
    pub uid: u32,
    pub size: Option<u32>,
    pub internal_date_ms: Option<i64>,
    pub flags: Flags,
    pub parsed: ParsedMessage,
}

fn json(addresses: &[MailAddress]) -> String {
    serde_json::to_string(addresses).unwrap_or_else(|_| "[]".into())
}

/// Inserts a batch of messages (ignoring ones already stored) with their attachment metadata.
pub async fn insert_messages(db: &SqlitePool, messages: Vec<NewMessage<'_>>) -> Result<usize> {
    let mut tx = db.begin().await?;
    let mut inserted = 0;
    for message in messages {
        if insert_message(&mut tx, message).await? {
            inserted += 1;
        }
    }
    tx.commit().await?;
    Ok(inserted)
}

async fn insert_message(tx: &mut Transaction<'_, Sqlite>, message: NewMessage<'_>) -> Result<bool> {
    let id = new_id();
    let parsed = &message.parsed;
    let from = parsed.from.clone().unwrap_or(MailAddress {
        name: None,
        address: String::new(),
    });
    let date = parsed
        .date_ms
        .or(message.internal_date_ms)
        .unwrap_or_else(crate::db::now_ms);

    let result = sqlx::query(
        "INSERT INTO messages (id, account_id, mailbox_id, uid, message_id_header, thread_id, in_reply_to, \
         subject, from_name, from_address, \"to\", cc, bcc, reply_to, snippet, body_text, body_html, date, size, \
         is_read, is_starred, is_draft, has_attachments) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) \
         ON CONFLICT (mailbox_id, uid) DO NOTHING",
    )
    .bind(&id)
    .bind(message.account_id)
    .bind(message.mailbox_id)
    .bind(i64::from(message.uid))
    .bind(&parsed.message_id)
    .bind(&parsed.thread_id)
    .bind(&parsed.in_reply_to)
    .bind(&parsed.subject)
    .bind(&from.name)
    .bind(&from.address)
    .bind(json(&parsed.to))
    .bind(json(&parsed.cc))
    .bind(json(&parsed.bcc))
    .bind(json(&parsed.reply_to))
    .bind(&parsed.snippet)
    .bind(&parsed.body_text)
    .bind(&parsed.body_html)
    .bind(date)
    .bind(message.size.map(i64::from))
    .bind(message.flags.seen)
    .bind(message.flags.flagged)
    .bind(message.flags.draft)
    .bind(!parsed.attachments.is_empty())
    .execute(&mut **tx)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false);
    }

    for attachment in &parsed.attachments {
        sqlx::query(
            "INSERT INTO attachments (id, message_id, filename, mime_type, size, content_id, is_inline) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(new_id())
        .bind(&id)
        .bind(&attachment.filename)
        .bind(&attachment.mime_type)
        .bind(attachment.size)
        .bind(&attachment.content_id)
        .bind(attachment.is_inline)
        .execute(&mut **tx)
        .await?;
    }
    Ok(true)
}
