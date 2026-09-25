//! Mail engine: protocol clients (IMAP for now) and persistence of synced data.

pub mod account;
pub mod auth;
pub mod imap;
pub mod parse;
pub mod send;
pub mod smtp;
pub mod store;
