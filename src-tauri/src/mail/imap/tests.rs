//! End-to-end sync tests against a real IMAP server, using the app's actual Drizzle migrations.
//! Ignored by default. Run with a disposable server, e.g. GreenMail:
//!
//! ```sh
//! java -Dgreenmail.setup.test.all -Dgreenmail.users=leari:secret@localhost -jar greenmail-standalone.jar
//! LEARI_TEST_IMAP=127.0.0.1:3143 LEARI_TEST_USER=leari LEARI_TEST_PASS=secret \
//!   cargo test imap_sync -- --ignored
//! ```
//! The test wipes the account's mailboxes, so never point it at a real account.

use std::str::FromStr;

use futures::TryStreamExt;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

use super::connection::{self, ImapSession};
use super::sync;
use crate::mail::account::{Account, Security, ServerConfig};

const MIGRATIONS: [&str; 2] = [
    include_str!("../../../../src/db/migrations/0000_init.sql"),
    include_str!("../../../../src/db/migrations/0001_pending_operations.sql"),
];

struct Env {
    server: ServerConfig,
    username: String,
    password: String,
}

fn env() -> Env {
    let address = std::env::var("LEARI_TEST_IMAP").expect("LEARI_TEST_IMAP=host:port");
    let (host, port) = address.rsplit_once(':').expect("host:port");
    Env {
        server: ServerConfig {
            host: host.into(),
            port: port.parse().unwrap(),
            security: Security::None,
        },
        username: std::env::var("LEARI_TEST_USER").expect("LEARI_TEST_USER"),
        password: std::env::var("LEARI_TEST_PASS").expect("LEARI_TEST_PASS"),
    }
}

async fn database() -> SqlitePool {
    let path = std::env::temp_dir().join(format!("leari-test-{}.db", uuid::Uuid::new_v4()));
    let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))
        .unwrap()
        .create_if_missing(true)
        .foreign_keys(true);
    let db = SqlitePoolOptions::new().connect_with(options).await.unwrap();
    for migration in MIGRATIONS {
        for statement in migration.split("--> statement-breakpoint") {
            sqlx::query(statement).execute(&db).await.unwrap();
        }
    }
    db
}

/// Mirrors what the frontend does when an account is added (account + placeholder mailboxes).
async fn create_account(db: &SqlitePool, env: &Env) -> Account {
    sqlx::query(
        "INSERT INTO accounts (id, provider, name, email, color, auth_type, username, incoming_protocol, \
         incoming_host, incoming_port, incoming_security, smtp_host, smtp_port, smtp_security) \
         VALUES ('acc', 'imap', 'Test', 'leari@localhost', '#000', 'password', ?, 'imap', ?, ?, 'none', ?, 3025, 'none')",
    )
    .bind(&env.username)
    .bind(&env.server.host)
    .bind(env.server.port)
    .bind(&env.server.host)
    .execute(db)
    .await
    .unwrap();

    for (index, (role, path)) in [
        ("inbox", "INBOX"),
        ("sent", "Sent"),
        ("drafts", "Drafts"),
        ("archive", "Archive"),
        ("trash", "Trash"),
    ]
    .iter()
    .enumerate()
    {
        sqlx::query("INSERT INTO mailboxes (id, account_id, path, name, role, sort_order) VALUES (?, 'acc', ?, ?, ?, ?)")
            .bind(format!("local-{role}"))
            .bind(path)
            .bind(path)
            .bind(role)
            .bind(index as i64)
            .execute(db)
            .await
            .unwrap();
    }

    crate::mail::account::load(db, "acc").await.unwrap()
}

async fn server_session(env: &Env) -> ImapSession {
    connection::connect(&env.server, &env.username, &env.password).await.unwrap()
}

fn message(subject: &str) -> String {
    format!(
        "From: Ana <ana@example.com>\r\nTo: leari@localhost\r\nSubject: {subject}\r\n\
         Message-ID: <{subject}@example.com>\r\nDate: Tue, 1 Sep 2026 10:00:00 +0000\r\n\r\nBody of {subject}\r\n"
    )
}

async fn reset_server(session: &mut ImapSession) {
    for folder in ["Archive", "Trash", "Sent Items", "Projects"] {
        let _ = session.delete(folder).await;
    }
    session.select("INBOX").await.unwrap();
    let _: Vec<_> = session
        .store("1:*", "+FLAGS.SILENT (\\Deleted)")
        .await
        .unwrap()
        .try_collect()
        .await
        .unwrap();
    let _: Vec<_> = session.expunge().await.unwrap().try_collect().await.unwrap();
    for folder in ["Archive", "Trash", "Sent Items", "Projects"] {
        session.create(folder).await.unwrap();
    }
}

async fn server_flags(session: &mut ImapSession, folder: &str) -> Vec<(String, Vec<String>)> {
    session.select(folder).await.unwrap();
    let fetches: Vec<_> = session
        .fetch("1:*", "(FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
        .await
        .unwrap()
        .try_collect()
        .await
        .unwrap();
    let mut result: Vec<_> = fetches
        .iter()
        .map(|fetch| {
            let header = String::from_utf8_lossy(fetch.header().unwrap_or_default()).to_string();
            let subject = header.trim().trim_start_matches("Subject: ").to_owned();
            let flags = fetch.flags().map(|flag| format!("{flag:?}")).collect();
            (subject, flags)
        })
        .collect();
    result.sort();
    result
}

async fn local(db: &SqlitePool, sql: &str) -> Vec<(String, bool, bool)> {
    sqlx::query_as(sql).fetch_all(db).await.unwrap()
}

const INBOX: &str = "SELECT m.subject, m.is_read, m.is_starred FROM messages m \
     JOIN mailboxes b ON b.id = m.mailbox_id WHERE b.role = 'inbox' ORDER BY m.subject";
const ARCHIVE: &str = "SELECT m.subject, m.is_read, m.is_starred FROM messages m \
     JOIN mailboxes b ON b.id = m.mailbox_id WHERE b.role = 'archive' ORDER BY m.subject";

#[tokio::test]
#[ignore = "needs a disposable IMAP server, see module docs"]
async fn imap_sync_round_trip() {
    let env = env();
    let db = database().await;
    let account = create_account(&db, &env).await;
    let mut server = server_session(&env).await;
    reset_server(&mut server).await;

    server.append("INBOX", None, None, message("alpha")).await.unwrap();
    server.append("INBOX", Some("(\\Seen)"), None, message("beta")).await.unwrap();
    server.append("INBOX", None, None, message("gamma")).await.unwrap();

    // 1. Initial sync: folders reconciled, messages and flags pulled.
    sync::sync_account(&db, &account, &env.password, &|| {}).await.unwrap();

    let mailboxes: Vec<(String, String, String)> =
        sqlx::query_as("SELECT id, path, role FROM mailboxes ORDER BY sort_order")
            .fetch_all(&db)
            .await
            .unwrap();
    let roles: Vec<(&str, &str)> =
        mailboxes.iter().map(|(_, path, role)| (path.as_str(), role.as_str())).collect();
    assert_eq!(
        roles,
        [
            ("INBOX", "inbox"),
            ("Sent Items", "sent"),
            ("Archive", "archive"),
            ("Trash", "trash"),
            ("Projects", "custom")
        ]
    );
    // Placeholders keep their ids when re-pointed; ones missing on the server are removed.
    assert!(mailboxes.iter().any(|(id, path, _)| id == "local-sent" && path == "Sent Items"));
    assert!(!mailboxes.iter().any(|(id, ..)| id == "local-drafts"));

    assert_eq!(
        local(&db, INBOX).await,
        [
            ("alpha".into(), false, false),
            ("beta".into(), true, false),
            ("gamma".into(), false, false)
        ]
    );

    // 2. Local changes are queued (as the frontend does) and pushed on the next sync.
    let id_of = |subject: &'static str| {
        let db = db.clone();
        async move {
            sqlx::query_as::<_, (String, i64)>("SELECT id, uid FROM messages WHERE subject = ?")
                .bind(subject)
                .fetch_one(&db)
                .await
                .unwrap()
        }
    };
    let (alpha, alpha_uid) = id_of("alpha").await;
    let (gamma, gamma_uid) = id_of("gamma").await;

    sqlx::query("UPDATE messages SET is_read = 1 WHERE id = ?")
        .bind(&alpha)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO pending_operations (id, account_id, message_id, kind, payload) VALUES ('op1', 'acc', ?, 'flags', ?)",
    )
    .bind(&alpha)
    .bind(format!(r#"{{"mailboxPath":"INBOX","uid":{alpha_uid},"seen":true}}"#))
    .execute(&db)
    .await
    .unwrap();

    sqlx::query("UPDATE messages SET mailbox_id = (SELECT id FROM mailboxes WHERE role = 'archive'), uid = NULL WHERE id = ?")
        .bind(&gamma)
        .execute(&db)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO pending_operations (id, account_id, message_id, kind, payload) VALUES ('op2', 'acc', ?, 'move', ?)",
    )
    .bind(&gamma)
    .bind(format!(r#"{{"mailboxPath":"INBOX","uid":{gamma_uid},"targetPath":"Archive"}}"#))
    .execute(&db)
    .await
    .unwrap();

    sync::sync_account(&db, &account, &env.password, &|| {}).await.unwrap();

    let pending: i64 =
        sqlx::query_scalar("SELECT count(*) FROM pending_operations").fetch_one(&db).await.unwrap();
    assert_eq!(pending, 0);

    let inbox = server_flags(&mut server, "INBOX").await;
    assert_eq!(inbox.len(), 2);
    assert!(inbox[0].0 == "alpha" && inbox[0].1.contains(&"Seen".to_string()));
    let archive = server_flags(&mut server, "Archive").await;
    assert_eq!(archive.iter().map(|(subject, _)| subject.as_str()).collect::<Vec<_>>(), ["gamma"]);

    assert_eq!(
        local(&db, INBOX).await,
        [("alpha".into(), true, false), ("beta".into(), true, false)]
    );
    assert_eq!(local(&db, ARCHIVE).await, [("gamma".into(), false, false)]);
    let gamma_uid_after: Option<i64> =
        sqlx::query_scalar("SELECT uid FROM messages WHERE subject = 'gamma'")
            .fetch_one(&db)
            .await
            .unwrap();
    assert!(gamma_uid_after.is_some(), "moved message is pulled again with its new UID");

    // 3. Changes made elsewhere: flag beta, expunge alpha, deliver delta.
    server.select("INBOX").await.unwrap();
    let _: Vec<_> = server
        .uid_store(alpha_uid.to_string(), "+FLAGS.SILENT (\\Deleted)")
        .await
        .unwrap()
        .try_collect()
        .await
        .unwrap();
    let _: Vec<_> = server.expunge().await.unwrap().try_collect().await.unwrap();
    let (_, beta_uid) = id_of("beta").await;
    let _: Vec<_> = server
        .uid_store(beta_uid.to_string(), "+FLAGS.SILENT (\\Flagged)")
        .await
        .unwrap()
        .try_collect()
        .await
        .unwrap();
    server.append("INBOX", None, None, message("delta")).await.unwrap();

    sync::sync_account(&db, &account, &env.password, &|| {}).await.unwrap();

    assert_eq!(
        local(&db, INBOX).await,
        [("beta".into(), true, true), ("delta".into(), false, false)]
    );

    server.logout().await.ok();
}
