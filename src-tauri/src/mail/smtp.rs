//! Outgoing mail: builds RFC 5322 messages and submits them over SMTP (lettre).

use std::time::Duration;

use lettre::message::header::ContentType;
use lettre::message::{Mailbox, Mailboxes};
use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use super::account::{Security, ServerConfig};
use super::auth::Auth;
use crate::error::{Error, Result};

const SMTP_TIMEOUT: Duration = Duration::from_secs(60);

pub struct Outgoing {
    pub from: Mailbox,
    pub to: Mailboxes,
    pub cc: Mailboxes,
    pub bcc: Mailboxes,
    pub subject: String,
    pub body: String,
    /// Message-ID of the message being replied to (without angle brackets).
    pub in_reply_to: Option<String>,
    /// Thread ancestry, oldest first (without angle brackets).
    pub references: Vec<String>,
}

/// Parses a recipient field: `a@x.com, "Doe, John" <j@y.com>; b@z.com`.
pub fn parse_recipients(input: &str) -> Result<Mailboxes> {
    let normalized = input.replace(';', ",");
    let trimmed = normalized.trim().trim_matches(',').trim();
    if trimmed.is_empty() {
        return Ok(Mailboxes::new());
    }
    trimmed.parse::<Mailboxes>().map_err(|_| Error::Invalid(input.trim().to_owned()))
}

fn angle(id: &str) -> String {
    format!("<{}>", id.trim_matches(|c| c == '<' || c == '>'))
}

/// Builds the message. The Message-ID uses the sender's domain; Bcc is kept out of the headers.
pub fn build(outgoing: Outgoing) -> Result<Message> {
    let domain = outgoing.from.email.domain().to_owned();
    let mut builder = Message::builder()
        .from(outgoing.from)
        .subject(outgoing.subject)
        .date_now()
        .message_id(Some(format!("<{}@{domain}>", uuid::Uuid::new_v4())));

    for recipient in outgoing.to {
        builder = builder.to(recipient);
    }
    for recipient in outgoing.cc {
        builder = builder.cc(recipient);
    }
    for recipient in outgoing.bcc {
        builder = builder.bcc(recipient);
    }
    if let Some(parent) = &outgoing.in_reply_to {
        builder = builder.in_reply_to(angle(parent));
    }
    if !outgoing.references.is_empty() {
        let references = outgoing.references.iter().map(|id| angle(id)).collect::<Vec<_>>();
        builder = builder.references(references.join(" "));
    }

    builder
        .header(ContentType::TEXT_PLAIN)
        .body(outgoing.body)
        .map_err(|error| Error::Invalid(error.to_string()))
}

fn smtp_error(error: lettre::transport::smtp::Error) -> Error {
    match error.status().map(|code| code.to_string()) {
        // 530 auth required, 534 mechanism too weak, 535 bad credentials.
        Some(code) if matches!(code.as_str(), "530" | "534" | "535") => {
            Error::Auth(error.to_string())
        }
        Some(_) => Error::Protocol(error.to_string()),
        None => Error::Network(error.to_string()),
    }
}

pub async fn send(
    server: &ServerConfig,
    username: &str,
    auth: Auth<'_>,
    message: &Message,
) -> Result<()> {
    let builder = match server.security {
        Security::Ssl => {
            AsyncSmtpTransport::<Tokio1Executor>::relay(&server.host).map_err(smtp_error)?
        }
        Security::Starttls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&server.host)
            .map_err(smtp_error)?,
        Security::None => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&server.host),
    };
    let (credentials, mechanisms) = match auth {
        Auth::Password(password) => (
            Credentials::new(username.into(), password.into()),
            vec![Mechanism::Plain, Mechanism::Login],
        ),
        Auth::OAuth2(token) => {
            (Credentials::new(username.into(), token.into()), vec![Mechanism::Xoauth2])
        }
    };

    let transport = builder
        .port(server.port)
        .credentials(credentials)
        .authentication(mechanisms)
        .timeout(Some(SMTP_TIMEOUT))
        .build();
    transport.send(message.clone()).await.map_err(smtp_error)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_recipient_lists() {
        let parsed = parse_recipients(r#"ana@x.com; "Doe, John" <john@y.com>, "#).unwrap();
        let addresses: Vec<String> = parsed.iter().map(|m| m.email.to_string()).collect();
        assert_eq!(addresses, ["ana@x.com", "john@y.com"]);
        assert_eq!(parse_recipients("  ").unwrap().iter().count(), 0);
        assert!(matches!(parse_recipients("not an address"), Err(Error::Invalid(_))));
    }

    #[test]
    fn builds_threaded_reply() {
        let message = build(Outgoing {
            from: "Ana <ana@example.com>".parse().unwrap(),
            to: parse_recipients("bob@example.com").unwrap(),
            cc: Mailboxes::new(),
            bcc: parse_recipients("secret@example.com").unwrap(),
            subject: "Re: Hello".into(),
            body: "Hi Bob".into(),
            in_reply_to: Some("parent@example.com".into()),
            references: vec!["root@example.com".into(), "parent@example.com".into()],
        })
        .unwrap();
        let raw = String::from_utf8(message.formatted()).unwrap();

        assert!(raw.contains("In-Reply-To: <parent@example.com>"));
        assert!(raw.contains("References: <root@example.com> <parent@example.com>"));
        assert!(raw.contains("@example.com>\r\n") && raw.contains("Message-ID: <"));
        assert!(!raw.contains("secret@example.com"), "Bcc must not appear in headers");
        assert!(message.envelope().to().iter().any(|a| a.to_string() == "secret@example.com"));
    }
}
