use std::str::FromStr;
use std::time::Duration;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePool, SqlitePoolOptions};
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};

/// Same file tauri-plugin-sql opens for the frontend (`sqlite:leari.db` in the app config dir).
/// The schema and migrations are owned by the frontend (Drizzle); Rust only reads and writes rows.
const DATABASE_FILE: &str = "leari.db";

pub async fn open(app: &AppHandle) -> Result<SqlitePool> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|error| Error::Other(error.to_string()))?;
    let path = dir.join(DATABASE_FILE);

    let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))?
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(Duration::from_secs(10))
        .foreign_keys(true);

    Ok(SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await?)
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
