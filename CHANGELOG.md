# Changelog

All notable changes to leari are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/) with `alpha`, `beta` and `rc` pre-release channels.

Add entries under **Unreleased** as changes land; `pnpm release <bump>` turns that section into
the new version, and the release workflow publishes it as the GitHub release notes.

## [Unreleased]

### Added

- Sending mail over SMTP (password or OAuth), with Cc/Bcc, reply threading headers and ⌘↵ to
  send; a copy is saved to Sent (Gmail and Microsoft 365 do this themselves)

### Added

- Sign in with Google (Gmail / Workspace) and Microsoft (Outlook / 365) using OAuth; tokens stay
  in the OS keychain and refresh automatically
- "Sign in again" in an account's context menu when its access expires
- Sync status in the sidebar footer: "Syncing…", "Updated 2 minutes ago" or sync failures
- Menu bar / tray icon shows a badge (and tooltip) while mail is syncing

### Fixed

- Language selector had no effect (Português (Brasil) fell back to English)
- Long sender names, subjects and account emails overflowed horizontally instead of truncating with "…"
- Wide HTML emails were cut off on the right; they are now scaled to fit the reader
- macOS asked for the Keychain password on every sync; passwords are now read once per launch

## [0.1.0-alpha.1] - 2026-09-25

### Added

- Tray / menu bar app with no dock icon; closing the window hides it
- Three-pane mail UI: unified folders, accounts, message list with search, reader, composer
- Local SQLite database (Drizzle ORM) with migrations
- IMAP sync engine: folders, messages, flags and expunges; local changes pushed back to the server
- Passwords stored in the OS keychain; connection test when adding an account
- Light and dark themes; English and Portuguese (Brasil)
