import type { MailboxRole } from "@models";
import { useMailboxes } from "./useMailboxes";
import { useUnreadCounts } from "./useUnreadCounts";

/** Sum of unread messages across every account's mailbox with the given role. */
export function useUnifiedUnreadCount(role: MailboxRole): number {
  const { data: mailboxes = [] } = useMailboxes();
  const { data: counts = {} } = useUnreadCounts();

  return mailboxes
    .filter((mailbox) => mailbox.role === role)
    .reduce((total, mailbox) => total + (counts[mailbox.id] ?? 0), 0);
}
