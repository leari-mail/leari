# Changelog

All notable changes to Leari are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/) with `alpha`, `beta` and `rc` pre-release channels.

Add entries under **Unreleased** as changes land; `pnpm release <bump>` turns that section into
the new version, and the release workflow publishes it as the GitHub release notes.

## [Unreleased]

### Added

- Rich text in the composer: bold, italic, underline, strikethrough, lists, quotes and links.
  Messages are sent as HTML with a plain-text version, and replies quote the original

## [0.1.0-alpha.5] - 2026-09-29

### Changed

- The macOS installer window continues the app icon: its sky and branch
- The app is named "Leari" (capitalized) when installed: `Leari.app`, `Leari.exe` and the installers

## [0.1.0-alpha.4] - 2026-09-29

### Added

- Setting to also show Leari in the Dock (macOS) or taskbar (Windows, Linux), like a regular app;
  clicking the Dock icon reopens the window

### Changed

- Clicking the menu bar / tray icon opens the window right away; hold the icon (or right-click)
  for its menu
- New app icon, menu bar icon and logo: a Lear's macaw perched on a branch with its wings raised,
  on a pale sky background

## [0.1.0-alpha.3] - 2026-09-28

### Added

- README screenshots (light and dark), generated from fictional demo data with `pnpm screenshots`
- Instant new mail: IMAP accounts keep an IDLE connection to the inbox, so new mail shows up
  (and notifies) right away instead of at the next 5-minute sync
- Notifications for new mail in inboxes (one per message, or a summary when many arrive)
- Unread count next to the menu bar icon (tooltip on Windows)
- Settings to turn both off
- POP3 accounts: new mail is downloaded into the inbox and left on the server; read state,
  folders and deleting are local; sent mail is kept in the local Sent folder
- Conversations: messages of the same thread show as one row (with a count) and together in
  the reader, oldest first, including your replies; older messages collapse to one line.
  Archive, delete, read and star apply to the conversation. Can be turned off in Settings

### Changed

- The product is written "Leari" (capital L) in the app's texts, menu bar and docs; file names
  (`leari.app`, installers) stay lowercase
- The account marker in lists is now a background tint in the account's color, fading from left
  to right (the old dot looked like an unread marker); the reader names the account the same
  way. Both are hidden with a single account

### Fixed

- Accounts with sync turned off were still contacted to push local changes

## [0.1.0-alpha.2] - 2026-09-25

### Added

- Attachments: listed in the reader (open with the default app or save a copy), downloaded on
  demand; attach files in the composer (button or drag and drop); forwarding keeps attachments
- Images embedded in HTML emails (logos, signatures) are displayed
- Sending mail over SMTP (password or OAuth), with Cc/Bcc, reply threading headers and ⌘↵ to
  send; a copy is saved to Sent (Gmail and Microsoft 365 do this themselves)
- Sign in with Google (Gmail / Workspace) and Microsoft (Outlook / 365) using OAuth; tokens stay
  in the OS keychain and refresh automatically
- "Sign in again" in an account's context menu when its access expires
- Sync status in the sidebar footer: "Syncing…", "Updated 2 minutes ago" or sync failures
- Menu bar / tray icon shows a badge (and tooltip) while mail is syncing

### Fixed

- macOS asked for the Keychain password again after every update; releases are now signed with
  a fixed certificate, so updates keep Keychain access
- Release builds failed with Xcode 27 ("mis-aligned LINKEDIT string pool")
- Development builds asked for the Keychain password after every rebuild; they are now signed
  with a local identity created automatically on first run
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
