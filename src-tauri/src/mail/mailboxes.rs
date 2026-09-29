//! Folder management: create, rename and delete an account's folders.
//!
//! The server's folder list is the source of truth (see `store::reconcile_mailboxes`), so these
//! run on the server right away (they are not queued like message changes) and then mirror the
//! change in the local `mailboxes` table. Accounts with sync turned off (the demo data) only
//! change locally; POP3 accounts have no server folders.

use sqlx::SqlitePool;

use super::account::Account;
use super::auth::{self, Auth, Secret};
use super::imap::connection::{self, ImapSession};
use crate::db::new_id;
use crate::error::{Error, Result};

#[derive(Debug, Clone, sqlx::FromRow)]
struct Row {
    id: String,
    account_id: String,
    path: String,
    role: String,
    delimiter: Option<String>,
}

async fn load(db: &SqlitePool, mailbox_id: &str) -> Result<Row> {
    sqlx::query_as("SELECT id, account_id, path, role, delimiter FROM mailboxes WHERE id = ?")
        .bind(mailbox_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| Error::Invalid(format!("unknown mailbox {mailbox_id}")))
}

async fn account_rows(db: &SqlitePool, account_id: &str) -> Result<Vec<Row>> {
    Ok(sqlx::query_as(
        "SELECT id, account_id, path, role, delimiter FROM mailboxes WHERE account_id = ?",
    )
    .bind(account_id)
    .fetch_all(db)
    .await?)
}

async fn sync_enabled(db: &SqlitePool, account_id: &str) -> Result<bool> {
    Ok(sqlx::query_scalar("SELECT sync_enabled FROM accounts WHERE id = ?")
        .bind(account_id)
        .fetch_one(db)
        .await?)
}

/// Credentials for changing the account's server folders, or `None` for accounts with sync
/// turned off (their folder changes stay local, like the demo data).
pub async fn credentials(db: &SqlitePool, account: &Account) -> Result<Option<Secret>> {
    if account.incoming_protocol == "pop3" {
        return Err(Error::Invalid("POP3 accounts have no server folders".into()));
    }
    if !sync_enabled(db, &account.id).await? {
        return Ok(None);
    }
    Ok(Some(auth::secret_for(account).await?))
}

async fn server_session(account: &Account, auth: Option<Auth<'_>>) -> Result<Option<ImapSession>> {
    match auth {
        Some(auth) => {
            Ok(Some(connection::connect(&account.incoming, &account.username, auth).await?))
        }
        None => Ok(None),
    }
}

fn valid_name(name: &str, delimiter: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() || name.contains(delimiter) {
        return Err(Error::Invalid(name.to_owned()));
    }
    Ok(name.to_owned())
}

/// The account's hierarchy delimiter, from any folder that reports one.
fn delimiter_of(rows: &[Row]) -> String {
    rows.iter().find_map(|row| row.delimiter.clone()).unwrap_or_else(|| "/".to_owned())
}

/// Where top-level folders go. Servers that keep every folder under INBOX (e.g. Dovecot with
/// the `INBOX.` namespace) get new ones there too.
fn root_prefix(rows: &[Row], delimiter: &str) -> String {
    let inbox_prefix = format!("INBOX{delimiter}");
    let others: Vec<&Row> = rows.iter().filter(|row| row.role != "inbox").collect();
    if !others.is_empty() && others.iter().all(|row| row.path.starts_with(&inbox_prefix)) {
        inbox_prefix
    } else {
        String::new()
    }
}

fn is_within(path: &str, ancestor: &str, delimiter: &str) -> bool {
    path == ancestor || path.starts_with(&format!("{ancestor}{delimiter}"))
}

/// Creates a folder at the top level or inside `parent_id`.
pub async fn create(
    db: &SqlitePool,
    account: &Account,
    auth: Option<Auth<'_>>,
    parent_id: Option<&str>,
    name: &str,
) -> Result<()> {
    let rows = account_rows(db, &account.id).await?;
    let delimiter = delimiter_of(&rows);
    let name = valid_name(name, &delimiter)?;
    let prefix = match parent_id {
        Some(parent_id) => {
            let parent = load(db, parent_id).await?;
            format!("{}{delimiter}", parent.path)
        }
        None => root_prefix(&rows, &delimiter),
    };
    let path = format!("{prefix}{}", utf7_imap::encode_utf7_imap(name.clone()));
    if rows.iter().any(|row| row.path == path) {
        return Err(Error::Invalid(name));
    }

    if let Some(mut session) = server_session(account, auth).await? {
        let result = session.create(&path).await;
        if result.is_ok() {
            // Some clients only show subscribed folders.
            session.subscribe(&path).await.ok();
        }
        session.logout().await.ok();
        result?;
    }

    let sort_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM mailboxes WHERE account_id = ?",
    )
    .bind(&account.id)
    .fetch_one(db)
    .await?;
    sqlx::query(
        "INSERT INTO mailboxes (id, account_id, path, name, role, delimiter, sort_order) VALUES (?, ?, ?, ?, 'custom', ?, ?)",
    )
    .bind(new_id())
    .bind(&account.id)
    .bind(&path)
    .bind(&name)
    .bind(&delimiter)
    .bind(sort_order)
    .execute(db)
    .await?;
    Ok(())
}

/// Renames a custom folder (its subfolders move along). Special folders keep their names.
pub async fn rename(
    db: &SqlitePool,
    account: &Account,
    auth: Option<Auth<'_>>,
    mailbox_id: &str,
    name: &str,
) -> Result<()> {
    let mailbox = load(db, mailbox_id).await?;
    if mailbox.role != "custom" {
        return Err(Error::Invalid(mailbox.path));
    }
    let rows = account_rows(db, &mailbox.account_id).await?;
    let delimiter = mailbox.delimiter.clone().unwrap_or_else(|| delimiter_of(&rows));
    let name = valid_name(name, &delimiter)?;
    let parent = mailbox.path.rsplit_once(delimiter.as_str()).map(|(parent, _)| parent);
    let encoded = utf7_imap::encode_utf7_imap(name.clone());
    let path = match parent {
        Some(parent) => format!("{parent}{delimiter}{encoded}"),
        None => encoded,
    };
    if path == mailbox.path {
        return Ok(());
    }
    if rows.iter().any(|row| row.path == path) {
        return Err(Error::Invalid(name));
    }

    if let Some(mut session) = server_session(account, auth).await? {
        let result = session.rename(&mailbox.path, &path).await;
        session.logout().await.ok();
        result?;
    }

    let mut tx = db.begin().await?;
    sqlx::query("UPDATE mailboxes SET path = ?, name = ? WHERE id = ?")
        .bind(&path)
        .bind(&name)
        .bind(&mailbox.id)
        .execute(&mut *tx)
        .await?;
    for child in rows
        .iter()
        .filter(|row| row.id != mailbox.id && is_within(&row.path, &mailbox.path, &delimiter))
    {
        let child_path = format!("{path}{}", &child.path[mailbox.path.len()..]);
        sqlx::query("UPDATE mailboxes SET path = ? WHERE id = ?")
            .bind(child_path)
            .bind(&child.id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Deletes a custom folder with its subfolders and all the mail in them.
pub async fn delete(
    db: &SqlitePool,
    account: &Account,
    auth: Option<Auth<'_>>,
    mailbox_id: &str,
) -> Result<()> {
    let mailbox = load(db, mailbox_id).await?;
    if mailbox.role != "custom" {
        return Err(Error::Invalid(mailbox.path));
    }
    let rows = account_rows(db, &mailbox.account_id).await?;
    let delimiter = mailbox.delimiter.clone().unwrap_or_else(|| delimiter_of(&rows));
    let mut doomed: Vec<Row> =
        rows.into_iter().filter(|row| is_within(&row.path, &mailbox.path, &delimiter)).collect();
    // Deepest first: some servers refuse to delete a folder that still has subfolders.
    doomed.sort_by_key(|row| std::cmp::Reverse(row.path.len()));

    if let Some(mut session) = server_session(account, auth).await? {
        let mut result = Ok(());
        for row in &doomed {
            session.unsubscribe(&row.path).await.ok();
            result = session.delete(&row.path).await;
            if result.is_err() {
                break;
            }
        }
        session.logout().await.ok();
        result?;
    }

    let mut tx = db.begin().await?;
    for row in &doomed {
        // Queued changes for mail in these folders can no longer be applied.
        sqlx::query(
            "DELETE FROM pending_operations WHERE account_id = ? AND json_extract(payload, '$.mailboxPath') = ?",
        )
        .bind(&row.account_id)
        .bind(&row.path)
        .execute(&mut *tx)
        .await?;
        sqlx::query("DELETE FROM mailboxes WHERE id = ?").bind(&row.id).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(path: &str, role: &str) -> Row {
        Row {
            id: path.into(),
            account_id: "a".into(),
            path: path.into(),
            role: role.into(),
            delimiter: Some(".".into()),
        }
    }

    #[test]
    fn nests_new_folders_under_inbox_only_when_the_server_does() {
        let dovecot =
            [row("INBOX", "inbox"), row("INBOX.Sent", "sent"), row("INBOX.Work", "custom")];
        assert_eq!(root_prefix(&dovecot, "."), "INBOX.");
        let flat = [row("INBOX", "inbox"), row("Sent", "sent")];
        assert_eq!(root_prefix(&flat, "."), "");
        assert_eq!(root_prefix(&[row("INBOX", "inbox")], "."), "");
    }

    #[test]
    fn checks_names_and_hierarchy() {
        assert_eq!(valid_name("  Receipts ", "/").unwrap(), "Receipts");
        assert!(valid_name("   ", "/").is_err());
        assert!(valid_name("a/b", "/").is_err());
        assert!(is_within("Work/2026", "Work", "/"));
        assert!(is_within("Work", "Work", "/"));
        assert!(!is_within("Workshop", "Work", "/"));
    }
}
