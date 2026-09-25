//! Account secrets live in the OS keychain (macOS Keychain, Windows Credential Manager,
//! Secret Service on Linux), keyed by account id. Never in SQLite.
//!
//! Reads are cached in memory for the lifetime of the process: on macOS every keychain read
//! by a binary the user hasn't "Always Allow"ed shows a prompt, and sync runs every few minutes.

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, OnceLock};

use keyring::Entry;

use crate::error::{Error, Result};
use crate::oauth::tokens::TokenSet;

const SERVICE: &str = "com.leari.mail";

fn cache() -> MutexGuard<'static, HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();
    CACHE.get_or_init(Default::default).lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn entry(account_id: &str) -> Result<Entry> {
    Ok(Entry::new(SERVICE, account_id)?)
}

/// Password accounts store the password; OAuth accounts store their [`TokenSet`] as JSON.
pub fn set_password(account_id: &str, password: &str) -> Result<()> {
    entry(account_id)?.set_password(password)?;
    cache().insert(account_id.to_owned(), password.to_owned());
    Ok(())
}

pub fn set_tokens(account_id: &str, tokens: &TokenSet) -> Result<()> {
    let json = serde_json::to_string(tokens).map_err(|error| Error::Other(error.to_string()))?;
    set_password(account_id, &json)
}

pub fn get_tokens(account_id: &str) -> Result<TokenSet> {
    serde_json::from_str(&get_password(account_id)?)
        .map_err(|_| Error::Auth("sign-in required for this account".into()))
}

pub fn get_password(account_id: &str) -> Result<String> {
    if let Some(password) = cache().get(account_id) {
        return Ok(password.clone());
    }
    match entry(account_id)?.get_password() {
        Ok(password) => {
            cache().insert(account_id.to_owned(), password.clone());
            Ok(password)
        }
        Err(keyring::Error::NoEntry) => {
            Err(Error::Auth("no password stored for this account".into()))
        }
        Err(error) => Err(error.into()),
    }
}

pub fn delete(account_id: &str) -> Result<()> {
    cache().remove(account_id);
    match entry(account_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}
