import { useAccounts, useMailboxes, useUnreadCounts } from "@hooks";

import { AccountSection } from "./AccountSection";

export function AccountList() {
  const { data: accounts = [] } = useAccounts();
  const { data: mailboxes = [] } = useMailboxes();
  const { data: unreadCounts = {} } = useUnreadCounts();

  return (
    <div className="space-y-1">
      {accounts.map((account) => (
        <AccountSection
          key={account.id}
          account={account}
          mailboxes={mailboxes.filter(
            (mailbox) => mailbox.accountId === account.id && mailbox.role !== "starred",
          )}
          unreadCounts={unreadCounts}
        />
      ))}
    </div>
  );
}
