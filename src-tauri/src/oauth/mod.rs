//! OAuth 2.0 sign-in for Google and Microsoft accounts: authorization code flow with PKCE
//! and a loopback redirect (RFC 8252). Tokens never reach the webview: the frontend gets an
//! opaque handle and attaches it to the account it creates; the refresh token is kept in the
//! OS keychain and access tokens are refreshed on demand for IMAP (XOAUTH2).

pub mod loopback;
pub mod pkce;
pub mod providers;
pub mod tokens;

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;
use tokio::time::timeout;

pub use providers::Provider;
use tokens::TokenSet;

use crate::credentials;
use crate::error::{Error, Result};

/// How long to wait for the user to finish signing in in the browser.
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(5 * 60);

#[derive(Default)]
pub struct OAuthState {
    /// Tokens from completed sign-ins, waiting for the frontend to create the account.
    pending: Mutex<HashMap<String, TokenSet>>,
    /// Cancels the sign-in in progress (dropping it cancels too).
    cancel: Mutex<Option<oneshot::Sender<()>>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInResult {
    /// Opaque reference to the tokens, passed back to [`attach`].
    pub handle: String,
    pub email: String,
    pub name: Option<String>,
}

pub fn configured_providers() -> Vec<Provider> {
    Provider::ALL.into_iter().filter(|provider| provider.config().is_some()).collect()
}

fn not_configured(provider: Provider) -> Error {
    Error::Unsupported(format!("{} sign-in is not configured in this build", provider.label()))
}

/// Opens the provider's sign-in page in the browser and waits for the user to come back.
pub async fn sign_in(
    app: &AppHandle,
    state: &OAuthState,
    provider: Provider,
    language: &str,
) -> Result<SignInResult> {
    let config = provider.config().ok_or_else(|| not_configured(provider))?;
    let loopback = loopback::bind().await?;
    let redirect_uri = format!("http://{}:{}", config.redirect_host, loopback.port);
    let pkce = pkce::generate();
    let csrf_state = pkce::random_token();

    let mut url =
        reqwest::Url::parse(config.auth_url).map_err(|error| Error::Other(error.to_string()))?;
    url.query_pairs_mut()
        .append_pair("client_id", config.client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", config.scopes)
        .append_pair("state", &csrf_state)
        .append_pair("code_challenge", &pkce.challenge)
        .append_pair("code_challenge_method", "S256")
        .extend_pairs(config.extra_auth_params);

    let (cancel_tx, cancel_rx) = oneshot::channel();
    // Starting a new sign-in cancels the previous one (its sender is dropped).
    *lock(&state.cancel) = Some(cancel_tx);

    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|error| Error::Other(format!("could not open the browser: {error}")))?;

    let page = loopback::Page::for_language(language);
    let code = tokio::select! {
        result = timeout(SIGN_IN_TIMEOUT, loopback.wait_for_code(&csrf_state, &page)) => result??,
        _ = cancel_rx => return Err(Error::Cancelled),
    };

    let (tokens, identity) =
        tokens::exchange_code(&config, &code, &pkce.verifier, &redirect_uri).await?;
    let identity = identity
        .ok_or_else(|| Error::Auth("the provider did not share the account's email".into()))?;

    let handle = pkce::random_token();
    lock(&state.pending).insert(handle.clone(), tokens);
    Ok(SignInResult { handle, email: identity.email, name: identity.name })
}

pub fn cancel(state: &OAuthState) {
    if let Some(sender) = lock(&state.cancel).take() {
        let _ = sender.send(());
    }
}

/// Stores the tokens of a completed sign-in for an account (new, or re-authorized).
pub fn attach(state: &OAuthState, account_id: &str, handle: &str) -> Result<()> {
    let tokens = lock(&state.pending)
        .remove(handle)
        .ok_or_else(|| Error::Auth("sign-in expired, please try again".into()))?;
    credentials::set_tokens(account_id, &tokens)
}

/// A valid access token for the account, refreshing (and re-storing) it when needed.
pub async fn access_token(account_id: &str, provider: Provider) -> Result<String> {
    let tokens = credentials::get_tokens(account_id)?;
    if tokens.is_fresh() {
        return Ok(tokens.access_token);
    }
    let config = provider.config().ok_or_else(|| not_configured(provider))?;
    let fresh = tokens::refresh(&config, &tokens).await?;
    credentials::set_tokens(account_id, &fresh)?;
    Ok(fresh.access_token)
}
