//! End-to-end sync tests against a real IMAP server, using the app's actual Drizzle migrations.
//! Ignored by default. Run with a disposable server, e.g. GreenMail:
//!
//! ```sh
//! java -Dgreenmail.setup.test.all -Dgreenmail.users=leari:secret@localhost -jar greenmail-standalone.jar
//! LEARI_TEST_IMAP=127.0.0.1:3143 LEARI_TEST_USER=leari LEARI_TEST_PASS=secret \
//!   cargo test imap_ -- --ignored
//! ```
//! The send test also needs SMTP (`LEARI_TEST_SMTP=127.0.0.1:3025`).
//! ```sh
//! ```
//! The test wipes the account's mailboxes, so never point it at a real account.

use std::str::FromStr;

use futures::TryStreamExt;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;

use super::connection::{self, Auth, ImapSession};
use super::sync;
use crate::mail::account::{Account, Security, ServerConfig};

/// The tests share one server mailbox, so they run one at a time.
static SERVER_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

const MIGRATIONS: [&str; 3] = [
    include_str!("../../../../src/db/migrations/0000_init.sql"),
    include_str!("../../../../src/db/migrations/0001_pending_operations.sql"),
    include_str!("../../../../src/db/migrations/0002_attachment_part_index.sql"),
];

/// Fails when a new drizzle migration is not added to [`MIGRATIONS`] above.
#[test]
fn migrations_list_is_complete() {
    let journal = include_str!("../../../../src/db/migrations/meta/_journal.json");
    let entries = journal.matches("\"tag\"").count();
    assert_eq!(entries, MIGRATIONS.len(), "add the new migration to MIGRATIONS in tests.rs");
}

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
    connection::connect(&env.server, &env.username, Auth::Password(&env.password)).await.unwrap()
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
    let _server = SERVER_LOCK.lock().await;
    let env = env();
    let db = database().await;
    let account = create_account(&db, &env).await;
    let mut server = server_session(&env).await;
    reset_server(&mut server).await;

    server.append("INBOX", None, None, message("alpha")).await.unwrap();
    server.append("INBOX", Some("(\\Seen)"), None, message("beta")).await.unwrap();
    server.append("INBOX", None, None, message("gamma")).await.unwrap();

    // 1. Initial sync: folders reconciled, messages and flags pulled.
    sync::sync_account(&db, &account, Auth::Password(&env.password), &|| {}).await.unwrap();

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

    sync::sync_account(&db, &account, Auth::Password(&env.password), &|| {}).await.unwrap();

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

    sync::sync_account(&db, &account, Auth::Password(&env.password), &|| {}).await.unwrap();

    assert_eq!(
        local(&db, INBOX).await,
        [("beta".into(), true, true), ("delta".into(), false, false)]
    );

    server.logout().await.ok();
}

/// XOAUTH2 login path. GreenMail accepts the account password as the bearer token; against a
/// real provider this needs a real access token.
#[tokio::test]
#[ignore = "needs a disposable IMAP server, see module docs"]
async fn imap_xoauth2_login() {
    let _server = SERVER_LOCK.lock().await;
    let env = env();
    let mut session = connection::connect(&env.server, &env.username, Auth::OAuth2(&env.password))
        .await
        .expect("XOAUTH2 login");
    session.select("INBOX").await.unwrap();
    session.logout().await.ok();

    let rejected =
        connection::connect(&env.server, &env.username, Auth::OAuth2("wrong-token")).await;
    assert!(matches!(rejected, Err(crate::error::Error::Auth(_))), "bad token is an auth error");
}

/// Sends through SMTP, checks delivery, the copy filed in Sent, and reply threading headers.
#[tokio::test]
#[ignore = "needs a disposable IMAP + SMTP server, see module docs"]
async fn imap_smtp_send_round_trip() {
    let _server = SERVER_LOCK.lock().await;
    let env = env();
    let smtp_address = std::env::var("LEARI_TEST_SMTP").expect("LEARI_TEST_SMTP=host:port");
    let (smtp_host, smtp_port) = smtp_address.rsplit_once(':').expect("host:port");

    let db = database().await;
    let mut account = create_account(&db, &env).await;
    account.smtp = ServerConfig {
        host: smtp_host.into(),
        port: smtp_port.parse().unwrap(),
        security: Security::None,
    };
    let mut server = server_session(&env).await;
    reset_server(&mut server).await;
    server.append("INBOX", None, None, message("original")).await.unwrap();
    sync::sync_account(&db, &account, Auth::Password(&env.password), &|| {}).await.unwrap();

    let attachment_path =
        std::env::temp_dir().join(format!("leari-{}-notes.txt", uuid::Uuid::new_v4()));
    std::fs::write(&attachment_path, "attached text").unwrap();

    let parent: String = sqlx::query_scalar("SELECT id FROM messages WHERE subject = 'original'")
        .fetch_one(&db)
        .await
        .unwrap();
    let request = crate::mail::send::SendRequest {
        account_id: "acc".into(),
        to: "leari@localhost".into(),
        cc: String::new(),
        bcc: String::new(),
        subject: "Re: original".into(),
        body: "Reply body".into(),
        reply_to_message_id: Some(parent),
        attachments: vec![crate::mail::send::DraftAttachment::File {
            path: attachment_path.to_string_lossy().into_owned(),
        }],
    };
    crate::mail::send::send_as(
        &db,
        &std::env::temp_dir(),
        &account,
        Auth::Password(&env.password),
        request,
    )
    .await
    .unwrap();

    // Delivered to the recipient (this test account)…
    let mut delivered = None;
    for _ in 0..20 {
        server.select("INBOX").await.unwrap();
        let fetches: Vec<_> =
            server.fetch("1:*", "(BODY.PEEK[])").await.unwrap().try_collect().await.unwrap();
        delivered = fetches
            .iter()
            .filter_map(|fetch| fetch.body().map(|body| String::from_utf8_lossy(body).to_string()))
            .find(|raw| raw.contains("Subject: Re: original"));
        if delivered.is_some() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(250)).await;
    }
    let delivered = delivered.expect("reply delivered to INBOX");
    assert!(delivered.contains("In-Reply-To: <original@example.com>"));
    assert!(delivered.contains("From: Test <leari@localhost>"));

    // …and filed in Sent (generic IMAP servers don't do it themselves).
    let sent = server_flags(&mut server, "Sent Items").await;
    assert_eq!(
        sent.iter().map(|(subject, _)| subject.as_str()).collect::<Vec<_>>(),
        ["Re: original"]
    );
    assert!(sent[0].1.contains(&"Seen".to_string()));
    assert!(delivered.contains("notes.txt"), "attachment delivered");

    // The received copy's attachment downloads on demand from the server.
    sync::sync_account(&db, &account, Auth::Password(&env.password), &|| {}).await.unwrap();
    let attachment_id: String = sqlx::query_scalar(
        "SELECT a.id FROM attachments a JOIN messages m ON m.id = a.message_id \
         JOIN mailboxes b ON b.id = m.mailbox_id WHERE b.role = 'inbox' AND m.subject = 'Re: original'",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    let cache = std::env::temp_dir().join(format!("leari-cache-{}", uuid::Uuid::new_v4()));
    let downloaded = crate::mail::attachments::ensure_downloaded_as(
        &db,
        &cache,
        &attachment_id,
        Some(Auth::Password(&env.password)),
    )
    .await
    .unwrap();
    assert!(downloaded.to_string_lossy().ends_with("notes.txt"));
    assert_eq!(std::fs::read_to_string(&downloaded).unwrap(), "attached text");

    server.logout().await.ok();
}
