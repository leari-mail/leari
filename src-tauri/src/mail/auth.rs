//! How the mail engine logs in to IMAP / SMTP: with the account's password, or with an OAuth
//! access token (SASL XOAUTH2, used by Gmail and Outlook).

use super::account::Account;
use crate::credentials;
use crate::error::{Error, Result};
use crate::oauth;

#[derive(Clone, Copy)]
pub enum Auth<'a> {
    Password(&'a str),
    OAuth2(&'a str),
}

/// An account's password or a currently valid access token.
pub struct Secret {
    value: String,
    oauth: bool,
}

impl Secret {
    pub fn auth(&self) -> Auth<'_> {
        if self.oauth {
            Auth::OAuth2(&self.value)
        } else {
            Auth::Password(&self.value)
        }
    }
}

/// Reads the password from the keychain, or returns a fresh access token (refreshing it if needed).
pub async fn secret_for(account: &Account) -> Result<Secret> {
    if account.auth_type == "oauth2" {
        let provider = oauth::Provider::from_account(&account.provider)
            .ok_or_else(|| Error::Unsupported(format!("OAuth for {}", account.provider)))?;
        let token = oauth::access_token(&account.id, provider).await?;
        Ok(Secret { value: token, oauth: true })
    } else {
        Ok(Secret { value: credentials::get_password(&account.id)?, oauth: false })
    }
}
