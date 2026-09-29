//! Sending a message from the composer: SMTP submission, then a copy in the Sent folder.

use std::path::{Path, PathBuf};

use lettre::message::Mailbox;
use serde::Deserialize;
use sqlx::SqlitePool;

use super::account::{self, Account};
use super::attachments;
use super::auth::{self, Auth};
use super::imap::connection;
use super::parse;
use super::smtp::{self, Outgoing, OutgoingAttachment};
use super::store::{self, Flags, NewMessage};
use crate::error::{Error, Result};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequest {
    pub account_id: String,
    /// Raw recipient fields as typed: comma- or semicolon-separated addresses.
    pub to: String,
    pub cc: String,
    pub bcc: String,
    pub subject: String,
    /// Plain-text body.
    pub body: String,
    /// HTML body from the rich text editor, sent as the text/html alternative.
    #[serde(default)]
    pub html: Option<String>,
    /// Local id of the message being replied to, for threading headers.
    pub reply_to_message_id: Option<String>,
    #[serde(default)]
    pub attachments: Vec<DraftAttachment>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DraftAttachment {
    /// A file on disk, picked or dropped in the composer.
    File { path: String },
    /// An attachment of a received message (when forwarding).
    #[serde(rename_all = "camelCase")]
    Forwarded { attachment_id: String },
}

/// Most providers reject messages above ~25 MB (Gmail, Outlook.com); base64 adds ~33%.
pub const MAX_ATTACHMENTS_BYTES: u64 = 18 * 1024 * 1024;

async fn load_attachments(
    db: &SqlitePool,
    cache_dir: &Path,
    drafts: &[DraftAttachment],
) -> Result<Vec<OutgoingAttachment>> {
    let mut attachments = Vec::with_capacity(drafts.len());
    let mut total = 0u64;
    for draft in drafts {
        let path = match draft {
            DraftAttachment::File { path } => PathBuf::from(path),
            DraftAttachment::Forwarded { attachment_id } => {
                attachments::ensure_downloaded(db, cache_dir, attachment_id).await?
            }
        };
        let bytes = tokio::fs::read(&path)
            .await
            .map_err(|_| Error::Invalid(path.to_string_lossy().into_owned()))?;
        total += bytes.len() as u64;
        if total > MAX_ATTACHMENTS_BYTES {
            return Err(Error::TooLarge(MAX_ATTACHMENTS_BYTES));
        }
        let name = path.file_name().map(|name| name.to_string_lossy().into_owned());
        let name = name.unwrap_or_else(|| "attachment".into());
        let content_type = mime_guess::from_path(&path).first_or_octet_stream().to_string();
        attachments.push(OutgoingAttachment { name, content_type, bytes });
    }
    Ok(attachments)
}

/// Gmail and Exchange Online store messages sent through their SMTP servers in Sent
/// themselves; appending would duplicate them.
fn server_saves_sent(account: &Account) -> bool {
    matches!(account.provider.as_str(), "google" | "microsoft")
}

fn sender(account: &Account) -> Result<Mailbox> {
    let email = account.email.parse().map_err(|_| Error::Invalid(account.email.clone()))?;
    let name = Some(account.name.trim().to_owned()).filter(|name| !name.is_empty());
    Ok(Mailbox::new(name, email))
}

/// `In-Reply-To` and `References` for a reply, from the stored parent message.
async fn threading(db: &SqlitePool, parent_id: &str) -> Result<(Option<String>, Vec<String>)> {
    let row: Option<(Option<String>, Option<String>)> =
        sqlx::query_as("SELECT message_id_header, thread_id FROM messages WHERE id = ?")
            .bind(parent_id)
            .fetch_optional(db)
            .await?;
    let Some((Some(parent), root)) = row else { return Ok((None, Vec::new())) };
    let references = match root {
        Some(root) if root != parent => vec![root, parent.clone()],
        _ => vec![parent.clone()],
    };
    Ok((Some(parent), references))
}

async fn append_to_sent(
    db: &SqlitePool,
    account: &Account,
    auth: Auth<'_>,
    raw: &[u8],
) -> Result<()> {
    let path: Option<String> = sqlx::query_scalar(
        "SELECT path FROM mailboxes WHERE account_id = ? AND role = 'sent' LIMIT 1",
    )
    .bind(&account.id)
    .fetch_optional(db)
    .await?;
    let Some(path) = path else { return Ok(()) };

    let mut session = connection::connect(&account.incoming, &account.username, auth).await?;
    session.append(&path, Some("(\\Seen)"), None, raw).await?;
    session.logout().await.ok();
    Ok(())
}

/// Files a sent message in the account's local Sent folder (POP3 accounts).
async fn store_local_sent(db: &SqlitePool, account: &Account, raw: &[u8]) -> Result<()> {
    let sent: Option<String> = sqlx::query_scalar(
        "SELECT id FROM mailboxes WHERE account_id = ? AND role = 'sent' LIMIT 1",
    )
    .bind(&account.id)
    .fetch_optional(db)
    .await?;
    let Some(sent) = sent else { return Ok(()) };
    store::insert_messages(
        db,
        vec![NewMessage {
            account_id: &account.id,
            mailbox_id: &sent,
            uid: None,
            remote_id: None,
            size: u32::try_from(raw.len()).ok(),
            internal_date_ms: None,
            flags: Flags { seen: true, flagged: false, draft: false },
            parsed: parse::parse(raw).unwrap_or_default(),
        }],
    )
    .await?;
    Ok(())
}

pub async fn send(db: &SqlitePool, cache_dir: &Path, request: SendRequest) -> Result<()> {
    let account = account::load(db, &request.account_id).await?;
    let secret = auth::secret_for(&account).await?;
    send_as(db, cache_dir, &account, secret.auth(), request).await
}

/// [`send`] with explicit credentials.
pub(crate) async fn send_as(
    db: &SqlitePool,
    cache_dir: &Path,
    account: &Account,
    auth: Auth<'_>,
    request: SendRequest,
) -> Result<()> {
    let to = smtp::parse_recipients(&request.to)?;
    let cc = smtp::parse_recipients(&request.cc)?;
    let bcc = smtp::parse_recipients(&request.bcc)?;
    if to.iter().count() + cc.iter().count() + bcc.iter().count() == 0 {
        return Err(Error::Invalid(String::new()));
    }

    let (in_reply_to, references) = match &request.reply_to_message_id {
        Some(parent_id) => threading(db, parent_id).await?,
        None => (None, Vec::new()),
    };

    let attachments = load_attachments(db, cache_dir, &request.attachments).await?;
    let message = smtp::build(Outgoing {
        from: sender(account)?,
        to,
        cc,
        bcc,
        subject: request.subject,
        body: request.body,
        html: request.html,
        in_reply_to,
        references,
        attachments,
    })?;

    smtp::send(&account.smtp, &account.username, auth, &message).await?;

    // The message is already sent: failing to file a copy must not report the send as failed.
    if account.incoming_protocol == "pop3" {
        // No server folders: keep the copy locally.
        if let Err(error) = store_local_sent(db, account, &message.formatted()).await {
            log::warn!("could not save sent message for {}: {error}", account.id);
        }
    } else if !server_saves_sent(account) {
        if let Err(error) = append_to_sent(db, account, auth, &message.formatted()).await {
            log::warn!("could not save sent message for {}: {error}", account.id);
        }
    }
    Ok(())
}
