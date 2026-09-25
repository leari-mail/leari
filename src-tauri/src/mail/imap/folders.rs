use async_imap::types::NameAttribute;
use futures::TryStreamExt;

use super::connection::ImapSession;
use crate::error::Result;
use crate::mail::store::FolderInfo;

/// Special roles in display order; custom folders come after them, alphabetically.
const ROLE_ORDER: [&str; 6] = ["inbox", "sent", "drafts", "archive", "spam", "trash"];

/// Name-based fallback for servers without SPECIAL-USE (RFC 6154).
fn role_from_name(name: &str) -> Option<&'static str> {
    match name.to_lowercase().as_str() {
        "sent" | "sent items" | "sent messages" | "sent mail" | "enviados" | "itens enviados" => {
            Some("sent")
        }
        "drafts" | "draft" | "rascunhos" => Some("drafts"),
        "archive" | "archives" | "arquivo" | "arquivados" => Some("archive"),
        "junk" | "junk email" | "junk e-mail" | "spam" | "lixo eletrônico" => Some("spam"),
        "trash" | "deleted items" | "deleted messages" | "bin" | "lixeira" | "itens excluídos" => {
            Some("trash")
        }
        _ => None,
    }
}

enum Classification {
    Role(&'static str),
    /// Virtual or duplicate views (Gmail "All Mail", "Starred", "Important") that would
    /// duplicate every message locally.
    Skip,
    Unknown,
}

fn classify(path: &str, attributes: &[NameAttribute<'_>]) -> Classification {
    if path.eq_ignore_ascii_case("INBOX") {
        return Classification::Role("inbox");
    }
    for attribute in attributes {
        match attribute {
            NameAttribute::NoSelect => return Classification::Skip,
            NameAttribute::All | NameAttribute::Flagged => return Classification::Skip,
            NameAttribute::Extension(ext) if ext.eq_ignore_ascii_case("\\Important") => {
                return Classification::Skip
            }
            NameAttribute::Extension(ext) if ext.eq_ignore_ascii_case("\\NonExistent") => {
                return Classification::Skip
            }
            NameAttribute::Sent => return Classification::Role("sent"),
            NameAttribute::Drafts => return Classification::Role("drafts"),
            NameAttribute::Archive => return Classification::Role("archive"),
            NameAttribute::Junk => return Classification::Role("spam"),
            NameAttribute::Trash => return Classification::Role("trash"),
            _ => {}
        }
    }
    Classification::Unknown
}

fn display_name(path: &str, delimiter: Option<&str>) -> String {
    let leaf = match delimiter {
        Some(delimiter) if !delimiter.is_empty() => path.rsplit(delimiter).next().unwrap_or(path),
        _ => path,
    };
    utf7_imap::decode_utf7_imap(leaf.to_owned())
}

pub async fn list(session: &mut ImapSession) -> Result<Vec<FolderInfo>> {
    let names: Vec<_> = session.list(Some(""), Some("*")).await?.try_collect().await?;

    let mut folders: Vec<FolderInfo> = Vec::new();
    let mut unknown: Vec<FolderInfo> = Vec::new();

    for name in &names {
        let path = name.name().to_owned();
        let delimiter = name.delimiter().map(str::to_owned);
        let display = display_name(&path, delimiter.as_deref());
        let folder = |role| FolderInfo {
            path: path.clone(),
            name: display.clone(),
            delimiter: delimiter.clone(),
            role,
            sort_order: 0,
        };

        match classify(&path, name.attributes()) {
            Classification::Skip => {}
            Classification::Role(role) => folders.push(folder(role)),
            Classification::Unknown => unknown.push(folder("custom")),
        }
    }

    // Name heuristics only fill roles the server did not declare.
    for mut folder in unknown {
        if let Some(role) = role_from_name(&folder.name) {
            if !folders.iter().any(|existing| existing.role == role) {
                folder.role = role;
            }
        }
        folders.push(folder);
    }

    // Each special role appears once; later duplicates become plain folders.
    let mut seen_roles = Vec::new();
    for folder in &mut folders {
        if folder.role == "custom" {
            continue;
        }
        if seen_roles.contains(&folder.role) {
            folder.role = "custom";
        } else {
            seen_roles.push(folder.role);
        }
    }

    folders.sort_by(|a, b| {
        let rank = |folder: &FolderInfo| {
            ROLE_ORDER.iter().position(|role| *role == folder.role).unwrap_or(ROLE_ORDER.len())
        };
        rank(a).cmp(&rank(b)).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    for (index, folder) in folders.iter_mut().enumerate() {
        folder.sort_order = index as i64;
    }

    Ok(folders)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_nested_utf7_names() {
        assert_eq!(display_name("INBOX/Relat&APM-rios", Some("/")), "Relatórios");
        assert_eq!(display_name("[Gmail]/Sent Mail", Some("/")), "Sent Mail");
        assert_eq!(display_name("Archive", None), "Archive");
    }

    #[test]
    fn falls_back_to_names() {
        assert_eq!(role_from_name("Sent Items"), Some("sent"));
        assert_eq!(role_from_name("Deleted Items"), Some("trash"));
        assert_eq!(role_from_name("Projects"), None);
    }
}
