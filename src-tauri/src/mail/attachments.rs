//! Attachments of received messages: downloaded from the server on demand (sync only stores
//! their metadata), cached under the app cache dir, then opened, saved or forwarded.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use futures::TryStreamExt;
use serde::Serialize;
use sqlx::SqlitePool;

use super::account;
use super::auth::{self, Auth};
use super::imap::connection;
use super::parse;
use crate::error::{Error, Result};

#[derive(sqlx::FromRow)]
struct AttachmentRow {
    message_id: String,
    filename: String,
    part_index: Option<i64>,
    local_path: Option<String>,
}

#[derive(sqlx::FromRow)]
struct MessageLocation {
    account_id: String,
    uid: Option<i64>,
    path: String,
}

/// A file picked in the composer (or an attachment being forwarded).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFile {
    pub path: String,
    pub name: String,
    pub size: u64,
}

/// Downloads the full raw message from the server (the only copy of attachment contents).
/// Uses the account's stored credentials unless `auth` is given.
async fn fetch_raw(db: &SqlitePool, message_id: &str, auth: Option<Auth<'_>>) -> Result<Vec<u8>> {
    let location: MessageLocation = sqlx::query_as(
        "SELECT m.account_id, m.uid, b.path FROM messages m JOIN mailboxes b ON b.id = m.mailbox_id \
         WHERE m.id = ?",
    )
    .bind(message_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| Error::Other("message not found".into()))?;
    // Just moved and not synced back yet: its UID in the new folder is unknown.
    let uid = location.uid.ok_or_else(|| Error::Other("message is still being moved".into()))?;

    let account = account::load(db, &location.account_id).await?;
    let secret;
    let auth = match auth {
        Some(auth) => auth,
        None => {
            secret = auth::secret_for(&account).await?;
            secret.auth()
        }
    };
    let mut session = connection::connect(&account.incoming, &account.username, auth).await?;
    session.examine(&location.path).await?;
    let fetches: Vec<_> =
        session.uid_fetch(uid.to_string(), "BODY.PEEK[]").await?.try_collect().await?;
    session.logout().await.ok();

    fetches
        .iter()
        .find_map(|fetch| fetch.body().map(<[u8]>::to_vec))
        .ok_or_else(|| Error::Other("message no longer exists on the server".into()))
}

/// Keeps the name but drops anything that could escape the target folder.
pub fn safe_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '\0') || c.is_control() { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.').to_owned();
    if cleaned.is_empty() {
        "attachment".into()
    } else {
        cleaned
    }
}

/// Returns the attachment's cached file, downloading it first if needed.
pub async fn ensure_downloaded(
    db: &SqlitePool,
    cache_dir: &Path,
    attachment_id: &str,
) -> Result<PathBuf> {
    ensure_downloaded_as(db, cache_dir, attachment_id, None).await
}

/// [`ensure_downloaded`] with explicit credentials.
pub(crate) async fn ensure_downloaded_as(
    db: &SqlitePool,
    cache_dir: &Path,
    attachment_id: &str,
    auth: Option<Auth<'_>>,
) -> Result<PathBuf> {
    let row: AttachmentRow = sqlx::query_as(
        "SELECT message_id, filename, part_index, local_path FROM attachments WHERE id = ?",
    )
    .bind(attachment_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| Error::Other("attachment not found".into()))?;

    if let Some(path) = row.local_path.map(PathBuf::from).filter(|path| path.exists()) {
        return Ok(path);
    }

    let raw = fetch_raw(db, &row.message_id, auth).await?;
    let index = row.part_index.and_then(|index| usize::try_from(index).ok());
    let bytes = parse::attachment_content(&raw, index, &row.filename)
        .ok_or_else(|| Error::Other("attachment not found in the message".into()))?;

    let dir = cache_dir.join("attachments").join(attachment_id);
    tokio::fs::create_dir_all(&dir).await?;
    let path = dir.join(safe_file_name(&row.filename));
    tokio::fs::write(&path, bytes).await?;

    sqlx::query("UPDATE attachments SET local_path = ? WHERE id = ?")
        .bind(path.to_string_lossy().as_ref())
        .bind(attachment_id)
        .execute(db)
        .await?;
    Ok(path)
}

/// `cid` → `data:` URL for the images an HTML body embeds.
pub async fn inline_images(db: &SqlitePool, message_id: &str) -> Result<HashMap<String, String>> {
    let raw = fetch_raw(db, message_id, None).await?;
    Ok(parse::inline_images(&raw)
        .into_iter()
        .map(|image| {
            let url = format!("data:{};base64,{}", image.mime_type, STANDARD.encode(image.bytes));
            (image.content_id, url)
        })
        .collect())
}

/// Files that run code when opened. leari reveals them in the file manager instead.
pub fn is_executable(name: &str) -> bool {
    const EXTENSIONS: &[&str] = &[
        "app", "command", "sh", "bash", "zsh", "pkg", "mpkg", "dmg", "workflow", "scpt", "jar",
        "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jse", "wsf", "lnk", "hta",
        "reg", "appimage", "deb", "rpm", "run", "bin",
    ];
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| EXTENSIONS.contains(&extension.to_lowercase().as_str()))
}

pub fn local_file(path: &Path) -> Result<LocalFile> {
    let metadata = std::fs::metadata(path)?;
    Ok(LocalFile {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default(),
        size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_cannot_escape() {
        assert_eq!(safe_file_name("../../etc/passwd"), "_.._etc_passwd");
        assert_eq!(safe_file_name("..."), "attachment");
        assert_eq!(safe_file_name("Relatório 2026.pdf"), "Relatório 2026.pdf");
        assert_eq!(safe_file_name("a\u{0}b:c.txt"), "a_b_c.txt");
    }

    #[test]
    fn detects_executables() {
        assert!(is_executable("invoice.PDF.exe"));
        assert!(is_executable("Installer.app"));
        assert!(!is_executable("invoice.pdf"));
        assert!(!is_executable("README"));
    }
}
