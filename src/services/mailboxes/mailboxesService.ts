import { invoke } from "@tauri-apps/api/core";
import { asc, count, eq } from "drizzle-orm";

import { db, mailboxes, messages } from "@db";
import type { Mailbox } from "@models";

export const mailboxesService = {
  list(): Promise<Mailbox[]> {
    return db.select().from(mailboxes).orderBy(asc(mailboxes.sortOrder), asc(mailboxes.name));
  },

  /** Unread message count per mailbox id, computed from local messages. */
  async unreadCounts(): Promise<Record<string, number>> {
    const rows = await db
      .select({ mailboxId: messages.mailboxId, unread: count() })
      .from(messages)
      .where(eq(messages.isRead, false))
      .groupBy(messages.mailboxId);

    return Object.fromEntries(rows.map((row) => [row.mailboxId, row.unread]));
  },

  /**
   * Folder changes run on the server right away (Rust, src-tauri/src/mail/mailboxes.rs), then
   * the account syncs. `parentId` null creates a top-level folder.
   */
  create: (accountId: string, parentId: string | null, name: string) =>
    invoke<void>("mailbox_create", { accountId, parentId, name }),

  rename: (accountId: string, mailboxId: string, name: string) =>
    invoke<void>("mailbox_rename", { accountId, mailboxId, name }),

  /** Deletes a custom folder, its subfolders and all their mail. */
  remove: (accountId: string, mailboxId: string) =>
    invoke<void>("mailbox_delete", { accountId, mailboxId }),
};
