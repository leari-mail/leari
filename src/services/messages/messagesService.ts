import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  like,
  max,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";

import { db, mailboxes, messages, type PendingOperationKind, pendingOperations } from "@db";
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
  accountId: string,
  messageId: string | null,
  kind: PendingOperationKind,
  payload: object,
) {
  return db.insert(pendingOperations).values({ id: newId(), accountId, messageId, kind, payload });
}

/** Roles messages can be moved to from anywhere (one mailbox per account). */
export type MoveRole = "inbox" | "archive" | "spam" | "trash";

async function roleMailbox(accountId: string, role: MoveRole) {
  const [mailbox] = await db
    .select({ id: mailboxes.id, path: mailboxes.path })
    .from(mailboxes)
    .where(and(eq(mailboxes.accountId, accountId), eq(mailboxes.role, role)))
    .limit(1);
  return mailbox;
}

/**
 * Where the server has the message now, forgetting any move still queued for it: a message
 * waiting to be moved has no UID yet, and its queued move is replaced by the new change.
 */
async function detach(id: string, location: Location) {
  const queued = location.uid === null ? await pendingMove(id) : undefined;
  if (queued) {
    await db.delete(pendingOperations).where(eq(pendingOperations.id, queued.id));
    return { mailboxPath: queued.payload.mailboxPath, uid: queued.payload.uid };
  }
  return location.uid !== null
    ? { mailboxPath: location.mailboxPath, uid: location.uid }
    : undefined;
}

async function folder(mailboxId: string) {
  const [mailbox] = await db
    .select({
      id: mailboxes.id,
      accountId: mailboxes.accountId,
      path: mailboxes.path,
      role: mailboxes.role,
    })
    .from(mailboxes)
    .where(eq(mailboxes.id, mailboxId))
    .limit(1);
  return mailbox;
}

async function highestUid(mailboxId: string) {
  const [row] = await db
    .select({ uid: max(messages.uid) })
    .from(messages)
    .where(eq(messages.mailboxId, mailboxId));
  return row?.uid ?? null;
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

  /**
   * All messages of a message's conversation in its account (e.g. inbox and your replies in
   * Sent), oldest first. Trash and spam are left out unless the message itself is there.
   */
  async conversation(messageId: string): Promise<Message[]> {
    const message = await this.get(messageId);
    if (!message) return [];
    if (!message.threadId) return [message];

    const hidden = await db
      .select({ id: mailboxes.id })
      .from(mailboxes)
      .where(
        and(eq(mailboxes.accountId, message.accountId), inArray(mailboxes.role, ["trash", "spam"])),
      );
    const hiddenIds = hidden.map((mailbox) => mailbox.id).filter((id) => id !== message.mailboxId);

    const rows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.accountId, message.accountId),
          eq(messages.threadId, message.threadId),
          hiddenIds.length ? notInArray(messages.mailboxId, hiddenIds) : undefined,
        ),
      )
      .orderBy(asc(messages.date));

    // The same message can exist in two folders (e.g. copied to Archive): show it once.
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = row.messageIdHeader ?? row.id;
      if (seen.has(key)) return row.id === message.id;
      seen.add(key);
      return true;
    });
  },

  async setRead(id: string, isRead: boolean): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    await db.update(messages).set({ isRead }).where(eq(messages.id, id));
    if (location.uid !== null) {
      await enqueue(location.accountId, id, "flags", {
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
      await enqueue(location.accountId, id, "flags", {
        mailboxPath: location.mailboxPath,
        uid: location.uid,
        flagged: isStarred,
      });
    }
    return location.accountId;
  },

  /** Deletes a message permanently. */
  async remove(id: string): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    const source = await detach(id, location);
    await db.delete(messages).where(eq(messages.id, id));
    if (source) await enqueue(location.accountId, id, "delete", source);
    return location.accountId;
  },

  /** Moves a message to another mailbox of its account (IMAP can't move between accounts). */
  async moveTo(id: string, mailboxId: string): Promise<string | undefined> {
    const location = await locate(id);
    const target = await folder(mailboxId);
    if (!location || !target || target.accountId !== location.accountId) return;
    if (target.id === location.mailboxId) return location.accountId;

    const source = await detach(id, location);
    // Moved back to where the server still has it: nothing to push, the UID is valid again.
    if (source?.mailboxPath === target.path) {
      await db
        .update(messages)
        .set({ mailboxId: target.id, uid: source.uid })
        .where(eq(messages.id, id));
      return location.accountId;
    }

    await db.update(messages).set({ mailboxId: target.id, uid: null }).where(eq(messages.id, id));
    if (source) {
      await enqueue(location.accountId, id, "move", { ...source, targetPath: target.path });
    }
    return location.accountId;
  },

  /**
   * Moves a message to its account's mailbox with the given role. Deleting from the trash (or
   * when the account has no trash) removes it permanently; without an Archive or Spam folder
   * the message stays where it is.
   */
  async moveToRole(id: string, role: MoveRole): Promise<string | undefined> {
    const location = await locate(id);
    if (!location) return;

    const target = await roleMailbox(location.accountId, role);
    if (role === "trash" && (!target || target.id === location.mailboxId)) return this.remove(id);
    if (!target) return;
    return this.moveTo(id, target.id);
  },

  /**
   * Marks every message of a mailbox read. On the server it covers the whole folder up to the
   * newest message downloaded, including older mail that was never downloaded.
   */
  async markAllRead(mailboxId: string): Promise<string | undefined> {
    const mailbox = await folder(mailboxId);
    if (!mailbox) return;

    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(eq(messages.mailboxId, mailboxId), eq(messages.isRead, false)));
    const maxUid = await highestUid(mailboxId);
    if (maxUid) {
      await enqueue(mailbox.accountId, null, "read_all", { mailboxPath: mailbox.path, maxUid });
    }
    return mailbox.accountId;
  },

  /**
   * Empties a mailbox: Trash and Spam (or any folder of an account without a trash) are deleted
   * permanently, other folders move to Trash. Like "mark all read", the server side covers the
   * whole folder up to the newest message downloaded, so mail that arrives meanwhile is kept.
   */
  async empty(mailboxId: string): Promise<string | undefined> {
    const mailbox = await folder(mailboxId);
    if (!mailbox) return;

    const trash =
      mailbox.role === "trash" || mailbox.role === "spam"
        ? undefined
        : await roleMailbox(mailbox.accountId, "trash");

    // Mail still waiting for a queued move (and POP3 mail) has no UID: handle it one by one.
    const unsynced = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.mailboxId, mailboxId), isNull(messages.uid)));
    for (const { id } of unsynced) {
      await (trash ? this.moveTo(id, trash.id) : this.remove(id));
    }

    const maxUid = await highestUid(mailboxId);
    // Moved mail is dropped here and shows up in Trash with the next sync, with its new UIDs.
    await db.delete(messages).where(eq(messages.mailboxId, mailboxId));
    if (maxUid) {
      await enqueue(
        mailbox.accountId,
        null,
        trash ? "move_all" : "delete_all",
        trash
          ? { mailboxPath: mailbox.path, maxUid, targetPath: trash.path }
          : { mailboxPath: mailbox.path, maxUid },
      );
    }
    return mailbox.accountId;
  },
};
