import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { accounts } from "./accounts";

export const pendingOperationKinds = ["flags", "move", "delete"] as const;

/**
 * Local changes waiting to be pushed to the server by the sync engine (src-tauri/src/mail).
 * Payloads reference mailbox paths and UIDs, so they survive local mailbox reconciliation.
 */
export const pendingOperations = sqliteTable(
  "pending_operations",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    messageId: text("message_id"),
    kind: text("kind", { enum: pendingOperationKinds }).notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("pending_operations_account_idx").on(table.accountId, table.createdAt)],
);
