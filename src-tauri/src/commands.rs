//! Tauri commands exposed to the frontend (see src/services/sync, src/services/credentials).

use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::credentials;
use crate::error::Result;
use crate::mail::account::ServerConfig;
use crate::mail::imap;
use crate::mail::send::{self, SendRequest};
use crate::oauth::{self, OAuthState, Provider, SignInResult};
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
    let auth = imap::connection::Auth::Password(&password);
    let mut session = imap::connection::connect(&server, &username, auth).await?;
    session.logout().await.ok();
    Ok(())
}

/// Providers this build can sign in with (depends on the client ids it was built with).
#[tauri::command]
pub fn oauth_providers() -> Vec<Provider> {
    oauth::configured_providers()
}

/// Opens the provider's sign-in page and resolves once the user completes it.
#[tauri::command]
pub async fn oauth_sign_in(
    app: AppHandle,
    state: State<'_, OAuthState>,
    provider: Provider,
    language: String,
) -> Result<SignInResult> {
    oauth::sign_in(&app, &state, provider, &language).await
}

#[tauri::command]
pub fn oauth_cancel(state: State<'_, OAuthState>) {
    oauth::cancel(&state);
}

/// Stores the tokens of a completed sign-in for an account.
#[tauri::command]
pub fn oauth_attach(
    state: State<'_, OAuthState>,
    account_id: String,
    handle: String,
) -> Result<()> {
    oauth::attach(&state, &account_id, &handle)
}

/// Sends a message, then syncs the account so the copy in Sent shows up.
#[tauri::command]
pub async fn mail_send(engine: State<'_, Arc<SyncEngine>>, request: SendRequest) -> Result<()> {
    let account_id = request.account_id.clone();
    send::send(engine.db().await?, request).await?;

    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn(async move { engine.sync_account(account_id).await });
    Ok(())
}
