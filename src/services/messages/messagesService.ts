import { and, desc, eq, getTableColumns, inArray, like, or, type SQL } from "drizzle-orm";
import { db, mailboxes, messages, pendingOperations } from "@db";
import { newId } from "@lib/ids";
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

/** Where a message lives on the server: needed to queue changes for the sync engine. */
async function locate(id: string) {
  const [location] = await db
    .select({
      accountId: messages.accountId,
      mailboxId: messages.mailboxId,
      uid: messages.uid,
      mailboxPath: mailboxes.path,
    })
    .from(messages)
    .innerJoin(mailboxes, eq(messages.mailboxId, mailboxes.id))
    .where(eq(messages.id, id))
    .limit(1);
  return location;
}

type Location = NonNullable<Awaited<ReturnType<typeof locate>>>;

interface MovePayload {
  mailboxPath: string;
  uid: number;
  targetPath: string;
}

async function pendingMove(messageId: string) {
  const [operation] = await db
    .select()
    .from(pendingOperations)
    .where(and(eq(pendingOperations.messageId, messageId), eq(pendingOperations.kind, "move")))
    .limit(1);
  return operation ? { id: operation.id, payload: operation.payload as MovePayload } : undefined;
}

function enqueue(
  location: Location,
  messageId: string,
  kind: "flags" | "move" | "delete",
  payload: object,
) {
  return db.insert(pendingOperations).values({
    id: newId(),
    accountId: location.accountId,
    messageId,
    kind,
    payload,
  });
}

/**
 * Local changes are applied immediately and queued in `pending_operations`; the Rust sync
 * engine pushes them to the server. Mutations return the account id so callers can trigger a push.
 */
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

  async setRead(id: string, isRead: boolean): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    await db.update(messages).set({ isRead }).where(eq(messages.id, id));
    if (location.uid !== null) {
      await enqueue(location, id, "flags", {
        mailboxPath: location.mailboxPath,
        uid: location.uid,
        seen: isRead,
      });
    }
    return location.accountId;
  },

  async setStarred(id: string, isStarred: boolean): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    await db.update(messages).set({ isStarred }).where(eq(messages.id, id));
    if (location.uid !== null) {
      await enqueue(location, id, "flags", {
        mailboxPath: location.mailboxPath,
        uid: location.uid,
        flagged: isStarred,
      });
    }
    return location.accountId;
  },

  /**
   * Moves a message to its account's mailbox with the given role. Deleting from the trash
   * (or when the account has no trash) removes it permanently.
   */
  async moveToRole(id: string, role: "trash" | "archive"): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    const [target] = await db
      .select({ id: mailboxes.id, path: mailboxes.path })
      .from(mailboxes)
      .where(and(eq(mailboxes.accountId, location.accountId), eq(mailboxes.role, role)))
      .limit(1);

    const deletePermanently = !target || target.id === location.mailboxId;

    // A message already waiting to be moved has no UID yet: retarget the queued move instead.
    const queued = location.uid === null ? await pendingMove(id) : undefined;
    const source = queued
      ? { mailboxPath: queued.payload.mailboxPath, uid: queued.payload.uid }
      : location.uid !== null
        ? { mailboxPath: location.mailboxPath, uid: location.uid }
        : undefined;
    if (queued) await db.delete(pendingOperations).where(eq(pendingOperations.id, queued.id));

    if (deletePermanently) {
      await db.delete(messages).where(eq(messages.id, id));
      if (source) await enqueue(location, id, "delete", source);
      return location.accountId;
    }

    // Moved back to where the server still has it: nothing to push, the UID is valid again.
    if (source?.mailboxPath === target.path) {
      await db
        .update(messages)
        .set({ mailboxId: target.id, uid: source.uid })
        .where(eq(messages.id, id));
      return location.accountId;
    }

    await db.update(messages).set({ mailboxId: target.id, uid: null }).where(eq(messages.id, id));
    if (source) await enqueue(location, id, "move", { ...source, targetPath: target.path });
    return location.accountId;
  },
};
