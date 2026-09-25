use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::{Error, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Security {
    Ssl,
    Starttls,
    None,
}

impl Security {
    fn parse(value: &str) -> Self {
        match value {
            "starttls" => Security::Starttls,
            "none" => Security::None,
            _ => Security::Ssl,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub security: Security,
}

/// The subset of an `accounts` row the mail engine needs.
#[derive(Debug, Clone)]
pub struct Account {
    pub id: String,
    pub provider: String,
    pub name: String,
    pub email: String,
    pub username: String,
    pub auth_type: String,
    pub incoming_protocol: String,
    pub incoming: ServerConfig,
    pub smtp: ServerConfig,
}

#[derive(sqlx::FromRow)]
struct AccountRow {
    id: String,
    provider: String,
    name: String,
    email: String,
    username: String,
    auth_type: String,
    incoming_protocol: String,
    incoming_host: String,
    incoming_port: i64,
    incoming_security: String,
    smtp_host: String,
    smtp_port: i64,
    smtp_security: String,
}

const SELECT: &str = "SELECT id, provider, name, email, username, auth_type, incoming_protocol, \
     incoming_host, incoming_port, incoming_security, smtp_host, smtp_port, smtp_security FROM accounts";

impl From<AccountRow> for Account {
    fn from(row: AccountRow) -> Self {
        Account {
            id: row.id,
            provider: row.provider,
            name: row.name,
            email: row.email,
            username: row.username,
            auth_type: row.auth_type,
            incoming_protocol: row.incoming_protocol,
            incoming: ServerConfig {
                host: row.incoming_host,
                port: row.incoming_port as u16,
                security: Security::parse(&row.incoming_security),
            },
            smtp: ServerConfig {
                host: row.smtp_host,
                port: row.smtp_port as u16,
                security: Security::parse(&row.smtp_security),
            },
        }
    }
}

pub async fn load(db: &SqlitePool, account_id: &str) -> Result<Account> {
    sqlx::query_as::<_, AccountRow>(&format!("{SELECT} WHERE id = ?"))
        .bind(account_id)
        .fetch_optional(db)
        .await?
        .map(Account::from)
        .ok_or_else(|| Error::Other(format!("account {account_id} not found")))
}

pub async fn list_ids(db: &SqlitePool) -> Result<Vec<String>> {
    Ok(sqlx::query_scalar("SELECT id FROM accounts WHERE sync_enabled = 1 ORDER BY sort_order")
        .fetch_all(db)
        .await?)
}

pub async fn mark_synced(db: &SqlitePool, account_id: &str, at: i64) -> Result<()> {
    sqlx::query("UPDATE accounts SET last_synced_at = ? WHERE id = ?")
        .bind(at)
        .bind(account_id)
        .execute(db)
        .await?;
    Ok(())
}
