//! POP3 accounts: download-only. Messages are left on the server and fetched once, tracked by
//! UIDL; everything else (read state, folders, deleting) is local.

pub mod client;
pub mod sync;
