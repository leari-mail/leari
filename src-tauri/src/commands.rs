//! Tauri commands exposed to the frontend (see src/services/sync, src/services/credentials).

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

use crate::credentials;
use crate::error::{Error, Result};
use crate::mail::account::ServerConfig;
use crate::mail::attachments::{self, LocalFile};
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

fn cache_dir(app: &AppHandle) -> Result<PathBuf> {
    app.path().app_cache_dir().map_err(|error| Error::Other(error.to_string()))
}

/// Sends a message, then syncs the account so the copy in Sent shows up.
#[tauri::command]
pub async fn mail_send(
    app: AppHandle,
    engine: State<'_, Arc<SyncEngine>>,
    request: SendRequest,
) -> Result<()> {
    let account_id = request.account_id.clone();
    send::send(engine.db().await?, &cache_dir(&app)?, request).await?;

    let engine = Arc::clone(&engine);
    tauri::async_runtime::spawn(async move { engine.sync_account(account_id).await });
    Ok(())
}

/// Opens an attachment with its default app (executables are revealed in the file manager).
#[tauri::command]
pub async fn attachment_open(
    app: AppHandle,
    engine: State<'_, Arc<SyncEngine>>,
    attachment_id: String,
) -> Result<()> {
    let path =
        attachments::ensure_downloaded(engine.db().await?, &cache_dir(&app)?, &attachment_id)
            .await?;
    let name = path.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();
    let opened = if attachments::is_executable(&name) {
        app.opener().reveal_item_in_dir(&path)
    } else {
        app.opener().open_path(path.to_string_lossy(), None::<&str>)
    };
    opened.map_err(|error| Error::Other(error.to_string()))
}

/// Asks where to save an attachment and copies it there. `None` when the user cancels.
#[tauri::command]
pub async fn attachment_save(
    app: AppHandle,
    engine: State<'_, Arc<SyncEngine>>,
    attachment_id: String,
) -> Result<Option<String>> {
    let source =
        attachments::ensure_downloaded(engine.db().await?, &cache_dir(&app)?, &attachment_id)
            .await?;
    let name =
        source.file_name().map(|name| name.to_string_lossy().into_owned()).unwrap_or_default();

    let dialog = app.dialog().file().set_file_name(name);
    let chosen = tauri::async_runtime::spawn_blocking(move || dialog.blocking_save_file())
        .await
        .map_err(|error| Error::Other(error.to_string()))?;
    let Some(target) = chosen else { return Ok(None) };
    let target = target.into_path().map_err(|error| Error::Other(error.to_string()))?;

    tokio::fs::copy(&source, &target).await?;
    Ok(Some(target.to_string_lossy().into_owned()))
}

/// `cid` → `data:` URLs for the images embedded in a message's HTML body.
#[tauri::command]
pub async fn message_inline_images(
    engine: State<'_, Arc<SyncEngine>>,
    message_id: String,
) -> Result<HashMap<String, String>> {
    attachments::inline_images(engine.db().await?, &message_id).await
}

/// Native file picker for the composer's "Attach" button.
#[tauri::command]
pub async fn attachments_pick(app: AppHandle) -> Result<Vec<LocalFile>> {
    let dialog = app.dialog().file();
    let picked = tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_files())
        .await
        .map_err(|error| Error::Other(error.to_string()))?
        .unwrap_or_default();
    picked
        .into_iter()
        .filter_map(|file| file.into_path().ok())
        .map(|path| attachments::local_file(&path))
        .collect()
}

/// Name and size of files dropped on the composer.
#[tauri::command]
pub fn attachments_stat(paths: Vec<String>) -> Result<Vec<LocalFile>> {
    paths
        .iter()
        .map(PathBuf::from)
        .filter(|path| path.is_file())
        .map(|path| attachments::local_file(&path))
        .collect()
}

/// Unread count shown on the menu bar / tray icon (0 hides it).
#[tauri::command]
pub fn tray_set_unread(app: AppHandle, count: u32) {
    crate::tray::set_unread(&app, count);
}

/// New-mail notification preferences, sent by the frontend at startup and on change.
#[tauri::command]
pub fn notifications_configure(enabled: bool, language: String) {
    crate::notify::configure(enabled, language);
}
