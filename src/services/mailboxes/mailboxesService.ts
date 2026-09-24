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
};
