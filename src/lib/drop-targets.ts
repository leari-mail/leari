import type { FolderSelection, Mailbox, MailboxRole } from "@models";

/**
 * Where messages dragged from the list can be dropped: one of an account's folders, or a
 * unified folder (its role, resolved in each message's own account; Starred stars them).
 */
export type DropTarget =
  { kind: "mailbox"; mailboxId: string } | { kind: "role"; role: MailboxRole };

const movableRoles: MailboxRole[] = ["inbox", "archive", "spam", "trash"];

/** The `data-drop-target` value of a sidebar row. */
export function dropTargetKey(target: DropTarget) {
  return target.kind === "mailbox" ? `mailbox:${target.mailboxId}` : `role:${target.role}`;
}

export function parseDropTarget(key: string | null | undefined): DropTarget | null {
  const [kind, value] = (key ?? "").split(/:(.*)/s);
  if (!value) return null;
  if (kind === "mailbox") return { kind, mailboxId: value };
  if (kind === "role") return { kind, role: value as MailboxRole };
  return null;
}

/**
 * Whether messages from `accountIds` (listed in `folder`) can be dropped on `target`. IMAP
 * can't move mail between accounts, dropping where the mail already is does nothing, and
 * Drafts takes no dropped mail.
 */
export function canDrop(
  target: DropTarget,
  accountIds: string[],
  folder: FolderSelection,
  mailboxes: Array<Pick<Mailbox, "id" | "accountId" | "role">>,
): boolean {
  if (accountIds.length === 0) return false;
  const current =
    folder.kind === "unified"
      ? folder.role
      : mailboxes.find((mailbox) => mailbox.id === folder.mailboxId)?.role;

  if (target.kind === "role") {
    if (target.role === "starred") return true;
    return movableRoles.includes(target.role) && target.role !== current;
  }

  const mailbox = mailboxes.find((item) => item.id === target.mailboxId);
  if (!mailbox || mailbox.role === "drafts") return false;
  if (accountIds.some((accountId) => accountId !== mailbox.accountId)) return false;
  if (folder.kind === "mailbox") return folder.mailboxId !== mailbox.id;
  return mailbox.role === "custom" || mailbox.role !== current;
}
