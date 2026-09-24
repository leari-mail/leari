import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import { accounts } from "./accounts";
import { mailboxes } from "./mailboxes";

export interface MailAddress {
  name?: string;
  address: string;
}

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    mailboxId: text("mailbox_id")
      .notNull()
      .references(() => mailboxes.id, { onDelete: "cascade" }),
    uid: integer("uid"),
    messageIdHeader: text("message_id_header"),
    threadId: text("thread_id"),
    inReplyTo: text("in_reply_to"),

    subject: text("subject").notNull().default(""),
    fromName: text("from_name"),
    fromAddress: text("from_address").notNull(),
    to: text("to", { mode: "json" }).$type<MailAddress[]>().notNull().default([]),
    cc: text("cc", { mode: "json" }).$type<MailAddress[]>().notNull().default([]),
    bcc: text("bcc", { mode: "json" }).$type<MailAddress[]>().notNull().default([]),
    replyTo: text("reply_to", { mode: "json" }).$type<MailAddress[]>().notNull().default([]),

    snippet: text("snippet").notNull().default(""),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    date: integer("date", { mode: "timestamp_ms" }).notNull(),
    size: integer("size"),

    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isStarred: integer("is_starred", { mode: "boolean" }).notNull().default(false),
    isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
    hasAttachments: integer("has_attachments", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    unique("messages_mailbox_uid_unique").on(table.mailboxId, table.uid),
    index("messages_mailbox_date_idx").on(table.mailboxId, table.date),
    index("messages_account_date_idx").on(table.accountId, table.date),
    index("messages_thread_idx").on(table.threadId),
  ],
);
