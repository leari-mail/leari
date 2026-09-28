//! Background sync scheduler. One sync per account at a time; requests arriving while an
//! account is syncing schedule one more run right after it. Progress is reported to the
//! frontend through events:
//! - `sync://status`  → [`SyncStatus`] whenever an account starts / finishes syncing
//! - `sync://changed` → `{ accountId }` whenever synced data was written to the database

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tokio::sync::OnceCell;
use tokio::time::timeout;

mod watch;

use crate::db;
use crate::error::{Error, Result};
use crate::mail::auth::Auth;
use crate::mail::{account, auth, imap, pop3};

const SYNC_INTERVAL: Duration = Duration::from_secs(5 * 60);
const ACCOUNT_SYNC_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub account_id: String,
    /// `idle` | `syncing` | `error`
    pub state: &'static str,
    pub error: Option<Error>,
    pub last_synced_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Mode {
    Full,
    PushOnly,
}

#[derive(Default)]
struct State {
    /// IDLE watchers by account id (see watch.rs).
    watchers: HashMap<String, tauri::async_runtime::JoinHandle<()>>,
    /// Accounts whose server has no IDLE (or POP3): not retried until restart.
    without_idle: HashSet<String>,
    running: HashSet<String>,
    rerun: HashSet<String>,
    statuses: HashMap<String, SyncStatus>,
    started: bool,
}

pub struct SyncEngine {
    app: AppHandle,
    db: OnceCell<SqlitePool>,
    state: Mutex<State>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChangedEvent<'a> {
    account_id: &'a str,
}

impl SyncEngine {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(SyncEngine { app, db: OnceCell::new(), state: Mutex::new(State::default()) })
    }

    /// A panic while holding the lock cannot leave `State` inconsistent, so poisoning is ignored.
    fn state(&self) -> MutexGuard<'_, State> {
        self.state.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub async fn db(&self) -> Result<&SqlitePool> {
        self.db.get_or_try_init(|| db::open(&self.app)).await
    }

    /// Starts the periodic sync loop. Called by the frontend once migrations ran; idempotent.
    pub fn start(self: &Arc<Self>) {
        {
            let mut state = self.state();
            if state.started {
                return;
            }
            state.started = true;
        }
        let engine = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            loop {
                engine.sync_all().await;
                tokio::time::sleep(SYNC_INTERVAL).await;
            }
        });
    }

    pub async fn sync_all(self: &Arc<Self>) {
        let ids = match self.db().await {
            Ok(db) => account::list_ids(db).await.unwrap_or_default(),
            Err(error) => {
                log::error!("sync: cannot open database: {error}");
                return;
            }
        };
        self.reconcile_watchers(&ids);
        let tasks: Vec<_> = ids.into_iter().map(|id| self.sync_account(id)).collect();
        futures::future::join_all(tasks).await;
    }

    /// Starts IDLE watchers for new accounts and stops the ones of removed accounts.
    fn reconcile_watchers(self: &Arc<Self>, account_ids: &[String]) {
        let mut state = self.state();
        state.watchers.retain(|id, handle| {
            let keep = account_ids.contains(id);
            if !keep {
                handle.abort();
            }
            keep
        });
        drop(state);
        for id in account_ids {
            self.ensure_watcher(id);
        }
    }

    fn ensure_watcher(self: &Arc<Self>, account_id: &str) {
        let mut state = self.state();
        if !state.watchers.contains_key(account_id) && !state.without_idle.contains(account_id) {
            let handle =
                tauri::async_runtime::spawn(watch::watch(Arc::clone(self), account_id.to_owned()));
            state.watchers.insert(account_id.to_owned(), handle);
        }
    }

    /// Called by a watcher that stopped on its own (account removed, IDLE unsupported).
    fn watcher_finished(&self, account_id: &str, idle_supported: bool) {
        let mut state = self.state();
        state.watchers.remove(account_id);
        if !idle_supported {
            state.without_idle.insert(account_id.to_owned());
        }
    }

    /// Stops an account's IDLE watcher right away (e.g. when the account is removed).
    pub fn stop_watcher(&self, account_id: &str) {
        if let Some(handle) = self.state().watchers.remove(account_id) {
            handle.abort();
        }
    }

    pub fn statuses(&self) -> Vec<SyncStatus> {
        self.state().statuses.values().cloned().collect()
    }

    /// Syncs one account now (or right after its current sync finishes).
    pub async fn sync_account(self: &Arc<Self>, account_id: String) {
        self.schedule(account_id, Mode::Full).await;
    }

    /// Only pushes queued local changes (read, star, move…): quick and silent.
    pub async fn push_account(self: &Arc<Self>, account_id: String) {
        self.schedule(account_id, Mode::PushOnly).await;
    }

    async fn schedule(self: &Arc<Self>, account_id: String, mut mode: Mode) {
        {
            let mut state = self.state();
            if !state.running.insert(account_id.clone()) {
                // The next run is always a full sync, which pushes pending changes first.
                state.rerun.insert(account_id);
                return;
            }
        }

        loop {
            if mode == Mode::Full {
                self.set_status(&account_id, "syncing", None);
            }
            let result = match timeout(ACCOUNT_SYNC_TIMEOUT, self.run(&account_id, mode)).await {
                Ok(result) => result,
                Err(elapsed) => Err(elapsed.into()),
            };
            match result {
                // Accounts with sync turned off were not contacted: drop the "syncing" state.
                Ok(false) => self.clear_status(&account_id),
                Ok(true) if mode == Mode::PushOnly => {}
                Ok(true) => {
                    self.set_status(&account_id, "idle", None);
                    // New accounts get instant updates without waiting for the next full cycle.
                    self.ensure_watcher(&account_id);
                }
                Err(error) => {
                    log::warn!("sync of account {account_id} failed: {error}");
                    self.set_status(&account_id, "error", Some(error));
                }
            }

            let mut state = self.state();
            if !state.rerun.remove(&account_id) {
                state.running.remove(&account_id);
                break;
            }
            mode = Mode::Full;
        }
    }

    /// Syncs (or pushes) an account. `Ok(false)` when it has sync turned off.
    async fn run(&self, account_id: &str, mode: Mode) -> Result<bool> {
        let db = self.db().await?;
        let account = account::load(db, account_id).await?;
        // Accounts with sync turned off (e.g. the demo data) are never contacted, not even to
        // push local changes.
        let enabled: bool = sqlx::query_scalar("SELECT sync_enabled FROM accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(db)
            .await?;
        if !enabled {
            return Ok(false);
        }

        let secret = auth::secret_for(&account).await?;
        let auth = secret.auth();

        let app = self.app.clone();
        let id = account_id.to_owned();
        let notify = move || {
            let _ = app.emit("sync://changed", ChangedEvent { account_id: &id });
        };

        if account.incoming_protocol == "pop3" {
            // POP3 has no folders or flags on the server: local changes stay local.
            sqlx::query("DELETE FROM pending_operations WHERE account_id = ?")
                .bind(account_id)
                .execute(db)
                .await?;
            let Auth::Password(password) = auth else {
                return Err(Error::Unsupported("POP3 with OAuth sign-in".into()));
            };
            if mode == Mode::Full {
                let arrived = pop3::sync::sync_account(db, &account, password, &notify).await?;
                account::mark_synced(db, account_id, db::now_ms()).await?;
                crate::notify::new_mail(&self.app, &account.email, &arrived);
            }
            return Ok(true);
        }

        match mode {
            Mode::Full => {
                let arrived = imap::sync::sync_account(db, &account, auth, &notify).await?;
                account::mark_synced(db, account_id, db::now_ms()).await?;
                crate::notify::new_mail(&self.app, &account.email, &arrived);
            }
            Mode::PushOnly => {
                imap::sync::push_account(db, &account, auth).await?;
                notify();
            }
        }
        Ok(true)
    }

    /// Forgets an account's sync state (e.g. sync turned off); the UI falls back to the
    /// last sync time stored in the database.
    fn clear_status(&self, account_id: &str) {
        self.state().statuses.remove(account_id);
        let syncing = self.state().statuses.values().any(|status| status.state == "syncing");
        crate::tray::set_syncing(&self.app, syncing);
        let status = SyncStatus {
            account_id: account_id.to_owned(),
            state: "idle",
            error: None,
            last_synced_at: None,
        };
        let _ = self.app.emit("sync://status", status);
    }

    fn set_status(&self, account_id: &str, state: &'static str, error: Option<Error>) {
        let status = {
            let mut guard = self.state();
            let previous = guard.statuses.get(account_id).and_then(|status| status.last_synced_at);
            let status = SyncStatus {
                account_id: account_id.to_owned(),
                state,
                error,
                last_synced_at: if state == "idle" { Some(db::now_ms()) } else { previous },
            };
            guard.statuses.insert(account_id.to_owned(), status.clone());
            let syncing = guard.statuses.values().any(|status| status.state == "syncing");
            (status, syncing)
        };
        let (status, syncing) = status;
        crate::tray::set_syncing(&self.app, syncing);
        let _ = self.app.emit("sync://status", status);
    }
}
