//! Account synchronization: push queued local changes, reconcile folders, then per mailbox
//! update flags / drop expunged messages and fetch new ones (newest first, in batches).

use std::collections::{HashMap, HashSet};

use async_imap::types::{Fetch, Flag};
use futures::TryStreamExt;
use sqlx::SqlitePool;

use super::connection::{self, Auth, ImapSession};
use super::{folders, ops};
use crate::error::{Error, Result};
use crate::mail::account::Account;
use crate::mail::parse;
use crate::mail::store::{self, Flags, LocalMailbox, NewMessage};

/// How many of the most recent messages a mailbox downloads on its first sync.
const INITIAL_WINDOW: u32 = 200;
const BATCH_SIZE: usize = 25;
/// Bigger messages only get their headers downloaded for now.
const MAX_FULL_FETCH_SIZE: u32 = 15 * 1024 * 1024;

fn flags_of(fetch: &Fetch) -> Flags {
    let mut flags = Flags { seen: false, flagged: false, draft: false };
    for flag in fetch.flags() {
        match flag {
            Flag::Seen => flags.seen = true,
            Flag::Flagged => flags.flagged = true,
            Flag::Draft => flags.draft = true,
            _ => {}
        }
    }
    flags
}

async fn server_support(session: &mut ImapSession) -> Result<ops::ServerSupport> {
    let capabilities = session.capabilities().await?;
    Ok(ops::ServerSupport {
        move_command: capabilities.has_str("MOVE"),
        uidplus: capabilities.has_str("UIDPLUS"),
    })
}

/// Only sends queued local changes to the server.
pub async fn push_account(db: &SqlitePool, account: &Account, auth: Auth<'_>) -> Result<()> {
    let mut session = connection::connect(&account.incoming, &account.username, auth).await?;
    let support = server_support(&mut session).await?;
    ops::push(db, &mut session, &account.id, support).await?;
    session.logout().await.ok();
    Ok(())
}

pub async fn sync_account(
    db: &SqlitePool,
    account: &Account,
    auth: Auth<'_>,
    on_progress: &(dyn Fn() + Send + Sync),
) -> Result<()> {
    let mut session = connection::connect(&account.incoming, &account.username, auth).await?;

    let support = server_support(&mut session).await?;
    ops::push(db, &mut session, &account.id, support).await?;

    let remote = folders::list(&mut session).await?;
    let mut mailboxes = store::reconcile_mailboxes(db, &account.id, &remote).await?;
    mailboxes.sort_by_key(|mailbox| remote.iter().position(|folder| folder.path == mailbox.path));
    on_progress();

    let pending = store::pending_message_ids(db, &account.id).await?;

    for mailbox in &mailboxes {
        match sync_mailbox(db, &mut session, &account.id, mailbox, &pending, on_progress).await {
            Ok(()) => {}
            Err(error @ Error::Network(_)) => return Err(error),
            // One broken folder must not stop the others.
            Err(error) => log::warn!("sync of {} failed: {error}", mailbox.path),
        }
    }

    session.logout().await.ok();
    Ok(())
}

async fn sync_mailbox(
    db: &SqlitePool,
    session: &mut ImapSession,
    account_id: &str,
    mailbox: &LocalMailbox,
    pending: &HashSet<String>,
    on_progress: &(dyn Fn() + Send + Sync),
) -> Result<()> {
    let status = session.examine(&mailbox.path).await?;

    let uid_validity = status.uid_validity;
    if mailbox.uid_validity.map(|value| value as u32) != uid_validity {
        // UIDs from another UIDVALIDITY epoch are meaningless: start over.
        store::reset_mailbox(db, &mailbox.id, uid_validity).await?;
    }
    store::set_mailbox_total(db, &mailbox.id, status.exists).await?;

    let known = store::known_messages(db, &mailbox.id).await?;

    // 1. Flags and expunges of messages we already have.
    if let Some(min_uid) = known.keys().min() {
        let server: HashMap<u32, Flags> = if status.exists == 0 {
            HashMap::new()
        } else {
            let fetches: Vec<Fetch> = session
                .uid_fetch(format!("{min_uid}:*"), "(UID FLAGS)")
                .await?
                .try_collect()
                .await?;
            fetches.iter().filter_map(|fetch| Some((fetch.uid?, flags_of(fetch)))).collect()
        };

        let mut gone = Vec::new();
        let mut changed = Vec::new();
        for (uid, message) in &known {
            if pending.contains(&message.id) {
                continue;
            }
            match server.get(uid) {
                None => gone.push(message.id.clone()),
                Some(flags)
                    if flags.seen != message.is_read || flags.flagged != message.is_starred =>
                {
                    changed.push((message.id.clone(), *flags));
                }
                Some(_) => {}
            }
        }
        if !gone.is_empty() || !changed.is_empty() {
            store::delete_messages(db, &gone).await?;
            store::update_flags(db, &changed).await?;
            on_progress();
        }
    }

    if status.exists == 0 {
        return Ok(());
    }

    // 2. New messages: everything above the highest known UID, or the most recent window.
    let fetches: Vec<Fetch> = match known.keys().max() {
        Some(max_uid) => {
            session
                .uid_fetch(format!("{}:*", max_uid + 1), "(UID RFC822.SIZE)")
                .await?
                .try_collect()
                .await?
        }
        None => {
            let start = status.exists.saturating_sub(INITIAL_WINDOW - 1).max(1);
            session.fetch(format!("{start}:*"), "(UID RFC822.SIZE)").await?.try_collect().await?
        }
    };
    let max_known = known.keys().max().copied().unwrap_or(0);
    let mut new_messages: Vec<(u32, u32)> = fetches
        .iter()
        .filter_map(|fetch| Some((fetch.uid?, fetch.size.unwrap_or(0))))
        // `N:*` always returns the last message, even when its UID is below N.
        .filter(|(uid, _)| *uid > max_known)
        .collect();
    new_messages.sort_by_key(|(uid, _)| std::cmp::Reverse(*uid));

    for batch in new_messages.chunks(BATCH_SIZE) {
        let (full, headers_only): (Vec<_>, Vec<_>) =
            batch.iter().partition(|(_, size)| *size <= MAX_FULL_FETCH_SIZE);

        let mut fetched: Vec<Fetch> = Vec::new();
        for (uids, query) in [
            (&full, "(UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[])"),
            (&headers_only, "(UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER])"),
        ] {
            if uids.is_empty() {
                continue;
            }
            let set = uids.iter().map(|(uid, _)| uid.to_string()).collect::<Vec<_>>().join(",");
            let mut result: Vec<Fetch> = session.uid_fetch(set, query).await?.try_collect().await?;
            fetched.append(&mut result);
        }

        let rows: Vec<NewMessage> = fetched
            .iter()
            .filter_map(|fetch| {
                let uid = fetch.uid?;
                let raw = fetch.body().or_else(|| fetch.header())?;
                Some(NewMessage {
                    account_id,
                    mailbox_id: &mailbox.id,
                    uid,
                    size: fetch.size,
                    internal_date_ms: fetch.internal_date().map(|date| date.timestamp_millis()),
                    flags: flags_of(fetch),
                    parsed: parse::parse(raw).unwrap_or_default(),
                })
            })
            .collect();

        store::insert_messages(db, rows).await?;
        on_progress();
    }

    Ok(())
}
