import type { Mailbox } from "@models";

export interface NestedMailbox {
  mailbox: Mailbox;
  /** Indentation level: how many of its parent folders are custom folders in the list. */
  depth: number;
}

type FolderFields = Pick<Mailbox, "id" | "path" | "name" | "role" | "delimiter" | "sortOrder">;

function parentPath(mailbox: FolderFields) {
  if (!mailbox.delimiter) return null;
  const index = mailbox.path.lastIndexOf(mailbox.delimiter);
  return index > 0 ? mailbox.path.slice(0, index) : null;
}

/**
 * One account's folders in sidebar order: special folders first (server order), then custom
 * folders as a tree, each subfolder right after its parent, siblings by name. Special folders
 * never get children indented under them (e.g. Dovecot's `INBOX.Work` stays at the top level).
 */
export function nestMailboxes<T extends FolderFields>(
  mailboxes: T[],
): Array<{ mailbox: T; depth: number }> {
  const special = mailboxes
    .filter((mailbox) => mailbox.role !== "custom")
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const custom = mailboxes.filter((mailbox) => mailbox.role === "custom");
  const byPath = new Map(custom.map((mailbox) => [mailbox.path, mailbox]));

  const children = new Map<string | null, T[]>();
  for (const mailbox of custom) {
    const parent = parentPath(mailbox);
    const key = parent && byPath.has(parent) ? parent : null;
    children.set(key, [...(children.get(key) ?? []), mailbox]);
  }

  const result: Array<{ mailbox: T; depth: number }> = special.map((mailbox) => ({
    mailbox,
    depth: 0,
  }));
  const visit = (key: string | null, depth: number) => {
    const siblings = (children.get(key) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    for (const mailbox of siblings) {
      result.push({ mailbox, depth });
      visit(mailbox.path, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}
