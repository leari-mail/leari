import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { messages } from "./messages";

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  contentId: text("content_id"),
  isInline: integer("is_inline", { mode: "boolean" }).notNull().default(false),
  localPath: text("local_path"),
});
