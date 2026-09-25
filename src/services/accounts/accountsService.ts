import type { Account, MailboxRole, NewAccount } from "@models";
import { asc, eq } from "drizzle-orm";

import { accounts, db, mailboxes } from "@db";
import { pickAccountColor } from "@lib/account-colors";
import { newId } from "@lib/ids";
import { credentialsService } from "@services/credentials";

export type CreateAccountInput = Omit<NewAccount, "id" | "color" | "sortOrder" | "createdAt">;

/** Created locally until the first sync replaces them with the server's folders. */
const defaultMailboxes: Array<{ role: MailboxRole; name: string; path: string }> = [
  { role: "inbox", name: "Inbox", path: "INBOX" },
  { role: "sent", name: "Sent", path: "Sent" },
  { role: "drafts", name: "Drafts", path: "Drafts" },
  { role: "archive", name: "Archive", path: "Archive" },
  { role: "spam", name: "Spam", path: "Spam" },
  { role: "trash", name: "Trash", path: "Trash" },
];

export const accountsService = {
  list(): Promise<Account[]> {
    return db.select().from(accounts).orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
  },

  async create(input: CreateAccountInput): Promise<Account> {
    const existing = await db.select({ id: accounts.id }).from(accounts);
    const id = newId();

    const [account] = await db
      .insert(accounts)
      .values({
        ...input,
        id,
        color: pickAccountColor(existing.length),
        sortOrder: existing.length,
      })
      .returning();

    await db.insert(mailboxes).values(
      defaultMailboxes.map((mailbox, index) => ({
        id: newId(),
        accountId: id,
        ...mailbox,
        sortOrder: index,
      })),
    );

    return account;
  },

  async remove(id: string): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
    await credentialsService.remove(id);
  },
};
