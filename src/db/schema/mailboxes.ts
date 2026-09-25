import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const mailboxRoles = [
  "inbox",
  "sent",
  "drafts",
  "archive",
  "spam",
  "trash",
  "starred",
  "custom",
] as const;

/** Remote folders / labels of an account. */
export const mailboxes = sqliteTable(
  "mailboxes",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: mailboxRoles }).notNull().default("custom"),
    delimiter: text("delimiter"),
    unreadCount: integer("unread_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
    uidValidity: integer("uid_validity"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    unique("mailboxes_account_path_unique").on(table.accountId, table.path),
    index("mailboxes_account_idx").on(table.accountId),
  ],
);
