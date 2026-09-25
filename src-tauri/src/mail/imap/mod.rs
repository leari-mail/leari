//! IMAP synchronization: connection, folder discovery, pushing local changes, pulling messages.

pub mod connection;
pub mod folders;
pub mod ops;
pub mod sync;

#[cfg(test)]
mod tests;
