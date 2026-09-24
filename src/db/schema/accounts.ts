import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accountProviders = ["google", "microsoft", "imap", "pop3"] as const;
export const authTypes = ["oauth2", "password"] as const;
export const connectionSecurities = ["ssl", "starttls", "none"] as const;
export const incomingProtocols = ["imap", "pop3"] as const;

/**
 * Mail accounts. Secrets (passwords, OAuth tokens) are never stored here —
 * they belong in the OS keychain, referenced by account id.
 */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: accountProviders }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  color: text("color").notNull(),
  authType: text("auth_type", { enum: authTypes }).notNull(),
  username: text("username").notNull(),

  incomingProtocol: text("incoming_protocol", { enum: incomingProtocols }).notNull(),
  incomingHost: text("incoming_host").notNull(),
  incomingPort: integer("incoming_port").notNull(),
  incomingSecurity: text("incoming_security", { enum: connectionSecurities }).notNull(),

  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecurity: text("smtp_security", { enum: connectionSecurities }).notNull(),

  signature: text("signature"),
  sortOrder: integer("sort_order").notNull().default(0),
  syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
