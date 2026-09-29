import { useMailboxes } from "@hooks/mailboxes/useMailboxes";
import { type NestedMailbox, nestMailboxes } from "@lib";
import type { MoveRole } from "@services";
import { useMailStore } from "@stores";

export type MoveTargets =
  | { kind: "none" }
  /** The selection is from one account: any of its folders. */
  | { kind: "mailboxes"; folders: NestedMailbox[] }
  /** Several accounts: only roles, each resolved in the message's own account. */
  | { kind: "roles"; roles: MoveRole[] };

const moveRoles: MoveRole[] = ["inbox", "archive", "spam", "trash"];

/** Where the selection can be moved. IMAP can't move mail between accounts. */
export function useMoveTargets(): MoveTargets {
  const rows = useMailStore((state) => state.selectedRows);
  const folder = useMailStore((state) => state.folder);
  const { data: mailboxes = [] } = useMailboxes();

  const accountIds = [...new Set(rows.map((row) => row.accountId))];
  if (accountIds.length === 0) return { kind: "none" };
  if (accountIds.length > 1) {
    const current = folder.kind === "unified" ? folder.role : undefined;
    return { kind: "roles", roles: moveRoles.filter((role) => role !== current) };
  }

  const here = (id: string, role: string) =>
    folder.kind === "mailbox" ? folder.mailboxId === id : folder.role === role;
  const folders = nestMailboxes(
    mailboxes.filter((mailbox) => mailbox.accountId === accountIds[0]),
  ).filter(({ mailbox }) => mailbox.role !== "drafts" && !here(mailbox.id, mailbox.role));
  return { kind: "mailboxes", folders };
}
