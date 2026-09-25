//! Background sync scheduler. One sync per account at a time; requests arriving while an
//! account is syncing schedule one more run right after it. Progress is reported to the
//! frontend through events:
//! - `sync://status`  → [`SyncStatus`] whenever an account starts / finishes syncing
//! - `sync://changed` → `{ accountId }` whenever synced data was written to the database

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use tokio::sync::OnceCell;
use tokio::time::timeout;

use crate::credentials;
use crate::db;
use crate::error::{Error, Result};
use crate::mail::{account, imap};

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
        Arc::new(SyncEngine {
            app,
            db: OnceCell::new(),
            state: Mutex::new(State::default()),
        })
    }

    pub async fn db(&self) -> Result<&SqlitePool> {
        self.db.get_or_try_init(|| db::open(&self.app)).await
    }

    /// Starts the periodic sync loop. Called by the frontend once migrations ran; idempotent.
    pub fn start(self: &Arc<Self>) {
        {
            let mut state = self.state.lock().unwrap();
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
        let tasks: Vec<_> = ids.into_iter().map(|id| self.sync_account(id)).collect();
        futures::future::join_all(tasks).await;
    }

    pub fn statuses(&self) -> Vec<SyncStatus> {
        self.state
            .lock()
            .unwrap()
            .statuses
            .values()
            .cloned()
            .collect()
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
            let mut state = self.state.lock().unwrap();
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
                Ok(()) if mode == Mode::PushOnly => {}
                Ok(()) => self.set_status(&account_id, "idle", None),
                Err(error) => {
                    log::warn!("sync of account {account_id} failed: {error}");
                    self.set_status(&account_id, "error", Some(error));
                }
            }

            let mut state = self.state.lock().unwrap();
            if !state.rerun.remove(&account_id) {
                state.running.remove(&account_id);
                break;
            }
            mode = Mode::Full;
        }
    }

    async fn run(&self, account_id: &str, mode: Mode) -> Result<()> {
        let db = self.db().await?;
        let account = account::load(db, account_id).await?;

        if account.incoming_protocol != "imap" {
            return Err(Error::Unsupported(
                "POP3 accounts are not supported yet".into(),
            ));
        }
        if account.auth_type == "oauth2" {
            return Err(Error::Auth(
                "sign-in with OAuth is not supported yet".into(),
            ));
        }
        let password = credentials::get_password(account_id)?;

        let app = self.app.clone();
        let id = account_id.to_owned();
        let notify = move || {
            let _ = app.emit("sync://changed", ChangedEvent { account_id: &id });
        };

        match mode {
            Mode::Full => {
                imap::sync::sync_account(db, &account, &password, &notify).await?;
                account::mark_synced(db, account_id, db::now_ms()).await?;
            }
            Mode::PushOnly => {
                imap::sync::push_account(db, &account, &password).await?;
                notify();
            }
        }
        Ok(())
    }

    fn set_status(&self, account_id: &str, state: &'static str, error: Option<Error>) {
        let status = {
            let mut guard = self.state.lock().unwrap();
            let previous = guard
                .statuses
                .get(account_id)
                .and_then(|status| status.last_synced_at);
            let status = SyncStatus {
                account_id: account_id.to_owned(),
                state,
                error,
                last_synced_at: if state == "idle" {
                    Some(db::now_ms())
                } else {
                    previous
                },
            };
            guard.statuses.insert(account_id.to_owned(), status.clone());
            status
        };
        let _ = self.app.emit("sync://status", status);
    }
}
