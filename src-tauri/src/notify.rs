//! New-mail notifications. Settings (enabled, language) come from the frontend.

use std::sync::{Mutex, MutexGuard};

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::mail::store::InsertedMessage;

/// Above this many new messages in one sync, a single summary is shown.
const INDIVIDUAL_LIMIT: usize = 3;

pub struct Settings {
    pub enabled: bool,
    pub language: String,
}

fn settings() -> MutexGuard<'static, Settings> {
    static SETTINGS: Mutex<Settings> =
        Mutex::new(Settings { enabled: true, language: String::new() });
    SETTINGS.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

pub fn configure(enabled: bool, language: String) {
    *settings() = Settings { enabled, language };
}

struct Texts {
    no_subject: &'static str,
    summary_title: &'static str,
    summary_body: &'static str,
}

fn texts(language: &str) -> Texts {
    if language.to_lowercase().starts_with("pt") {
        Texts {
            no_subject: "(sem assunto)",
            summary_title: "{count} novas mensagens",
            summary_body: "Em {account}",
        }
    } else {
        Texts {
            no_subject: "(no subject)",
            summary_title: "{count} new messages",
            summary_body: "In {account}",
        }
    }
}

/// What to show for the messages that just arrived in an account: one notification per
/// message, or a summary when many arrive at once.
pub fn plan(account: &str, messages: &[InsertedMessage], language: &str) -> Vec<(String, String)> {
    let texts = texts(language);
    if messages.len() > INDIVIDUAL_LIMIT {
        return vec![(
            texts.summary_title.replace("{count}", &messages.len().to_string()),
            texts.summary_body.replace("{account}", account),
        )];
    }
    messages
        .iter()
        .map(|message| {
            let subject = if message.subject.trim().is_empty() {
                texts.no_subject.to_owned()
            } else {
                message.subject.clone()
            };
            (message.sender.clone(), subject)
        })
        .collect()
}

pub fn new_mail(app: &AppHandle, account: &str, messages: &[InsertedMessage]) {
    let (enabled, language) = {
        let settings = settings();
        (settings.enabled, settings.language.clone())
    };
    if !enabled || messages.is_empty() {
        return;
    }
    for (title, body) in plan(account, messages, &language) {
        if let Err(error) = app.notification().builder().title(title).body(body).show() {
            log::warn!("could not show notification: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(sender: &str, subject: &str) -> InsertedMessage {
        InsertedMessage { sender: sender.into(), subject: subject.into(), is_read: false }
    }

    #[test]
    fn one_notification_per_message_up_to_the_limit() {
        let plan = plan("a@x.com", &[message("Ana", "Hi"), message("Bob", " ")], "en");
        assert_eq!(plan, [("Ana".into(), "Hi".into()), ("Bob".into(), "(no subject)".into())]);
    }

    #[test]
    fn summarizes_many_messages_in_the_user_language() {
        let many: Vec<_> = (0..5).map(|i| message(&format!("S{i}"), "x")).collect();
        assert_eq!(
            plan("a@x.com", &many, "pt-BR"),
            [("5 novas mensagens".into(), "Em a@x.com".into())]
        );
        assert_eq!(plan("a@x.com", &many, "en")[0].0, "5 new messages");
    }
}
