use mail_parser::{Address, HeaderValue, MessageParser, MimeHeaders};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct MailAddress {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    pub address: String,
}

#[derive(Debug, Clone)]
pub struct AttachmentInfo {
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
    pub content_id: Option<String>,
    pub is_inline: bool,
}

/// Everything leari stores about a message, extracted from its raw RFC 5322 source.
#[derive(Debug, Clone, Default)]
pub struct ParsedMessage {
    pub message_id: Option<String>,
    pub in_reply_to: Option<String>,
    pub thread_id: Option<String>,
    pub subject: String,
    pub from: Option<MailAddress>,
    pub to: Vec<MailAddress>,
    pub cc: Vec<MailAddress>,
    pub bcc: Vec<MailAddress>,
    pub reply_to: Vec<MailAddress>,
    pub date_ms: Option<i64>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub snippet: String,
    pub attachments: Vec<AttachmentInfo>,
}

const SNIPPET_LENGTH: usize = 200;

fn addresses(address: Option<&Address>) -> Vec<MailAddress> {
    address
        .map(|list| {
            list.iter()
                .filter_map(|addr| {
                    Some(MailAddress {
                        name: addr
                            .name()
                            .map(str::to_owned)
                            .filter(|name| !name.is_empty()),
                        address: addr.address()?.to_owned(),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

fn header_ids(value: &HeaderValue) -> Vec<String> {
    match value {
        HeaderValue::Text(id) => vec![id.to_string()],
        HeaderValue::TextList(ids) => ids.iter().map(|id| id.to_string()).collect(),
        _ => Vec::new(),
    }
}

pub fn snippet(text: &str) -> String {
    let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed.chars().take(SNIPPET_LENGTH).collect()
}

/// Parses a full message (headers + body) or just its headers.
pub fn parse(raw: &[u8]) -> Option<ParsedMessage> {
    let message = MessageParser::default().parse(raw)?;

    let message_id = message.message_id().map(str::to_owned);
    let references = header_ids(message.references());
    let in_reply_to = header_ids(message.in_reply_to()).into_iter().next();
    // Thread root: first entry of References, else the replied message, else itself.
    let thread_id = references
        .first()
        .cloned()
        .or_else(|| in_reply_to.clone())
        .or_else(|| message_id.clone());

    let body_html = message
        .html_part(0)
        .filter(|part| part.is_text_html())
        .and_then(|part| part.text_contents())
        .map(str::to_owned);
    let body_text = message.body_text(0).map(|text| text.into_owned());

    let attachments = message
        .attachments()
        .map(|part| AttachmentInfo {
            filename: part.attachment_name().unwrap_or("attachment").to_owned(),
            mime_type: part
                .content_type()
                .map(|ct| match ct.subtype() {
                    Some(subtype) => format!("{}/{}", ct.ctype(), subtype),
                    None => ct.ctype().to_owned(),
                })
                .unwrap_or_else(|| "application/octet-stream".into()),
            size: part.len() as i64,
            content_id: part.content_id().map(str::to_owned),
            is_inline: part.content_disposition().is_some_and(|cd| cd.is_inline()),
        })
        .collect();

    Some(ParsedMessage {
        message_id,
        in_reply_to,
        thread_id,
        subject: message.subject().unwrap_or_default().to_owned(),
        from: addresses(message.from()).into_iter().next(),
        to: addresses(message.to()),
        cc: addresses(message.cc()),
        bcc: addresses(message.bcc()),
        reply_to: addresses(message.reply_to()),
        date_ms: message.date().map(|date| date.to_timestamp() * 1000),
        snippet: body_text.as_deref().map(snippet).unwrap_or_default(),
        body_text,
        body_html,
        attachments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multipart_message() {
        let raw = b"Message-ID: <b@x>\r\nIn-Reply-To: <a@x>\r\nReferences: <root@x> <a@x>\r\n\
From: Ana <ana@example.com>\r\nTo: bob@example.com, \"Carl\" <carl@example.com>\r\n\
Subject: Hello\r\nDate: Tue, 1 Sep 2026 10:00:00 +0000\r\nMIME-Version: 1.0\r\n\
Content-Type: multipart/alternative; boundary=\"b\"\r\n\r\n\
--b\r\nContent-Type: text/plain\r\n\r\nHi   there\r\nBob\r\n\
--b\r\nContent-Type: text/html\r\n\r\n<p>Hi there</p>\r\n--b--\r\n";

        let parsed = parse(raw).unwrap();
        assert_eq!(parsed.subject, "Hello");
        assert_eq!(parsed.from.unwrap().name.as_deref(), Some("Ana"));
        assert_eq!(parsed.to.len(), 2);
        assert_eq!(parsed.thread_id.as_deref(), Some("root@x"));
        assert_eq!(parsed.in_reply_to.as_deref(), Some("a@x"));
        assert_eq!(parsed.snippet, "Hi there Bob");
        assert!(parsed.body_html.unwrap().contains("<p>"));
        assert_eq!(parsed.date_ms, Some(1_788_256_800_000));
    }

    #[test]
    fn plain_text_message_has_no_html() {
        let raw = b"From: a@example.com\r\nSubject: Plain\r\n\r\nJust text";
        let parsed = parse(raw).unwrap();
        assert!(parsed.body_html.is_none());
        assert_eq!(parsed.body_text.as_deref(), Some("Just text"));
    }
}
