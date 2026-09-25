//! Tauri commands exposed to the frontend (see src/services/sync, src/services/credentials).

use std::sync::Arc;

use tauri::State;

use crate::credentials;
use crate::error::Result;
use crate::mail::account::ServerConfig;
use crate::mail::imap;
use crate::sync::{SyncEngine, SyncStatus};

#[tauri::command]
pub fn sync_start(engine: State<'_, Arc<SyncEngine>>) {
    engine.start();
}

/// Syncs one account, or all of them when `account_id` is omitted. Returns immediately.
#[tauri::command]
pub fn sync_now(engine: State<'_, Arc<SyncEngine>>, account_id: Option<String>) {
    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn(async move {
        match account_id {
            Some(id) => engine.sync_account(id).await,
            None => engine.sync_all().await,
        }
    });
}

/// Pushes an account's queued local changes to the server. Returns immediately.
#[tauri::command]
pub fn sync_push(engine: State<'_, Arc<SyncEngine>>, account_id: String) {
    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn(async move { engine.push_account(account_id).await });
}

#[tauri::command]
pub fn sync_statuses(engine: State<'_, Arc<SyncEngine>>) -> Vec<SyncStatus> {
    engine.statuses()
}

#[tauri::command]
pub fn credentials_set_password(account_id: String, password: String) -> Result<()> {
    credentials::set_password(&account_id, &password)
}

#[tauri::command]
pub fn credentials_delete(account_id: String) -> Result<()> {
    credentials::delete(&account_id)
}

/// Checks that the server is reachable and accepts the credentials.
#[tauri::command]
pub async fn imap_test_connection(
    server: ServerConfig,
    username: String,
    password: String,
) -> Result<()> {
    let mut session = imap::connection::connect(&server, &username, &password).await?;
    session.logout().await.ok();
    Ok(())
}
