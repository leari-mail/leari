//! Instant new mail: one IMAP IDLE connection per account on its inbox. When the server
//! reports a change, the account is synced right away instead of at the next 5-minute tick.

use std::sync::Arc;
use std::time::{Duration, Instant};

use super::SyncEngine;
use crate::error::Result;
use crate::mail::imap::connection;
use crate::mail::imap::idle::{self, Wake};
use crate::mail::{account, auth};

/// Servers may drop IDLE after 30 minutes (RFC 2177): renew before that.
const IDLE_RENEW: Duration = Duration::from_secs(25 * 60);
const FIRST_RETRY: Duration = Duration::from_secs(30);
const MAX_RETRY: Duration = Duration::from_secs(10 * 60);
/// Several notifications usually arrive together (EXISTS, RECENT, FETCH): sync once.
const SETTLE: Duration = Duration::from_secs(1);

enum Stop {
    AccountRemoved,
    /// POP3 account or server without IDLE: periodic sync covers it.
    NotSupported,
}

/// Watches one account until it is removed or doesn't support IDLE; reconnects with backoff.
pub async fn watch(engine: Arc<SyncEngine>, account_id: String) {
    let mut retry = FIRST_RETRY;
    let mut idle_supported = true;
    loop {
        let started = Instant::now();
        match session(&engine, &account_id).await {
            Ok(Stop::AccountRemoved) => break,
            Ok(Stop::NotSupported) => {
                log::info!("IDLE not available for account {account_id}; using periodic sync");
                idle_supported = false;
                break;
            }
            Err(error) => {
                // A connection that lived a while was healthy: start backing off from scratch.
                if started.elapsed() > MAX_RETRY {
                    retry = FIRST_RETRY;
                }
                log::info!(
                    "IDLE for account {account_id} stopped ({error}); retrying in {retry:?}"
                );
                tokio::time::sleep(retry).await;
                retry = (retry * 2).min(MAX_RETRY);
            }
        }
    }
    engine.watcher_finished(&account_id, idle_supported);
}

async fn session(engine: &Arc<SyncEngine>, account_id: &str) -> Result<Stop> {
    let db = engine.db().await?;
    let Ok(account) = account::load(db, account_id).await else { return Ok(Stop::AccountRemoved) };
    if account.incoming_protocol != "imap" {
        return Ok(Stop::NotSupported);
    }

    let secret = auth::secret_for(&account).await?;
    let mut session =
        connection::connect(&account.incoming, &account.username, secret.auth()).await?;
    if !session.capabilities().await?.has_str("IDLE") {
        session.logout().await.ok();
        return Ok(Stop::NotSupported);
    }

    let inbox: Option<String> = sqlx::query_scalar(
        "SELECT path FROM mailboxes WHERE account_id = ? AND role = 'inbox' LIMIT 1",
    )
    .bind(account_id)
    .fetch_optional(db)
    .await?;
    session.examine(inbox.as_deref().unwrap_or("INBOX")).await?;

    loop {
        let (next, wake) = idle::wait_for_change(session, IDLE_RENEW).await?;
        session = next;
        if wake == Wake::Changed {
            tokio::time::sleep(SETTLE).await;
            let engine = Arc::clone(engine);
            let id = account_id.to_owned();
            tauri::async_runtime::spawn(async move { engine.sync_account(id).await });
        }
    }
}
