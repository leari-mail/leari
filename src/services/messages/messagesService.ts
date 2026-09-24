import { and, desc, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { db, mailboxes, messages } from "@db";
import type { FolderSelection, Message, MessageSummary } from "@models";

const { bodyText: _bodyText, bodyHtml: _bodyHtml, ...summaryColumns } = getTableColumns(messages);

function folderFilter(folder: FolderSelection): SQL | undefined {
  if (folder.kind === "mailbox") return eq(messages.mailboxId, folder.mailboxId);

  // Unified "Starred" is a flag across every account, not a server folder.
  if (folder.role === "starred") return eq(messages.isStarred, true);

  const mailboxIds = db
    .select({ id: mailboxes.id })
    .from(mailboxes)
    .where(eq(mailboxes.role, folder.role));
  return inArray(messages.mailboxId, mailboxIds);
}

function searchFilter(query: string): SQL | undefined {
  const term = query.trim();
  if (!term) return undefined;
  const pattern = `%${term}%`;
  return or(
    like(messages.subject, pattern),
    like(messages.fromName, pattern),
    like(messages.fromAddress, pattern),
    like(messages.snippet, pattern),
  );
}

export const messagesService = {
  list(folder: FolderSelection, search = ""): Promise<MessageSummary[]> {
    return db
      .select(summaryColumns)
      .from(messages)
      .where(and(folderFilter(folder), searchFilter(search)))
      .orderBy(desc(messages.date))
      .limit(500);
  },

  async get(id: string): Promise<Message | null> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return message ?? null;
  },

  async setRead(id: string, isRead: boolean): Promise<void> {
    await db.update(messages).set({ isRead }).where(eq(messages.id, id));
  },

  async setStarred(id: string, isStarred: boolean): Promise<void> {
    await db.update(messages).set({ isStarred }).where(eq(messages.id, id));
  },

  /** Moves a message to its account's mailbox with the given role (e.g. trash, archive). */
  async moveToRole(id: string, role: "trash" | "archive"): Promise<void> {
    const message = await this.get(id);
    if (!message) return;

    const [target] = await db
      .select({ id: mailboxes.id })
      .from(mailboxes)
      .where(and(eq(mailboxes.accountId, message.accountId), eq(mailboxes.role, role)))
      .limit(1);

    if (!target || target.id === message.mailboxId) {
      if (role === "trash") await db.delete(messages).where(eq(messages.id, id));
      return;
    }
    await db.update(messages).set({ mailboxId: target.id }).where(eq(messages.id, id));
  },
};
