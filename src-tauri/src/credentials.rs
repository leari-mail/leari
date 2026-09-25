//! Account secrets live in the OS keychain (macOS Keychain, Windows Credential Manager,
//! Secret Service on Linux), keyed by account id. Never in SQLite.

use keyring::Entry;

use crate::error::{Error, Result};

const SERVICE: &str = "com.leari.mail";

fn entry(account_id: &str) -> Result<Entry> {
    Ok(Entry::new(SERVICE, account_id)?)
}

pub fn set_password(account_id: &str, password: &str) -> Result<()> {
    entry(account_id)?.set_password(password)?;
    Ok(())
}

pub fn get_password(account_id: &str) -> Result<String> {
    match entry(account_id)?.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => {
            Err(Error::Auth("no password stored for this account".into()))
        }
        Err(error) => Err(error.into()),
    }
}

pub fn delete(account_id: &str) -> Result<()> {
    match entry(account_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}
