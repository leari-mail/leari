import type { MailboxRole } from "./mailbox";

/**
 * What the message list is showing: either a unified smart folder across
 * all accounts (e.g. "All Inboxes") or a single account mailbox.
 */
export type FolderSelection =
  | { kind: "unified"; role: MailboxRole }
  | { kind: "mailbox"; mailboxId: string; accountId: string };
