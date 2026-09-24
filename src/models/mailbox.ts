import type { mailboxes, mailboxRoles } from "@db/schema";

export type Mailbox = typeof mailboxes.$inferSelect;
export type NewMailbox = typeof mailboxes.$inferInsert;
export type MailboxRole = (typeof mailboxRoles)[number];
