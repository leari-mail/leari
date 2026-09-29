//! Mail engine: protocol clients (IMAP for now) and persistence of synced data.

pub mod account;
pub mod attachments;
pub mod auth;
pub mod imap;
pub mod mailboxes;
pub mod net;
pub mod parse;
pub mod pop3;
pub mod send;
pub mod smtp;
pub mod store;
