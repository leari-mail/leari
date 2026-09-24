import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MailboxItem } from "@components/mailboxes";
import type { Account, Mailbox } from "@models";
import { cn } from "@lib";
import { useMailStore } from "@stores";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@ui";
import { AccountDot } from "./AccountDot";
import { RemoveAccountDialog } from "./RemoveAccountDialog";

interface AccountSectionProps {
  account: Account;
  mailboxes: Mailbox[];
  unreadCounts: Record<string, number>;
}

/** Collapsible sidebar group with an account and its mailboxes. */
export function AccountSection({ account, mailboxes, unreadCounts }: AccountSectionProps) {
  const { t } = useTranslation(["mail", "accounts"]);
  const [expanded, setExpanded] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const folder = useMailStore((state) => state.folder);
  const selectFolder = useMailStore((state) => state.selectFolder);

  const inbox = mailboxes.find((mailbox) => mailbox.role === "inbox");
  const inboxUnread = inbox ? (unreadCounts[inbox.id] ?? 0) : 0;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <ChevronRight
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-90",
              )}
            />
            <AccountDot color={account.color} />
            <span className="flex-1 truncate text-left font-medium">{account.email}</span>
            {!expanded && inboxUnread > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{inboxUnread}</span>
            )}
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
            {t("accounts:remove")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {expanded && (
        <div className="space-y-px pl-4">
          {mailboxes.map((mailbox) => (
            <MailboxItem
              key={mailbox.id}
              role={mailbox.role}
              label={mailbox.role === "custom" ? mailbox.name : t(`mail:folders.${mailbox.role}`)}
              count={
                mailbox.role === "inbox" || mailbox.role === "custom" ? unreadCounts[mailbox.id] : 0
              }
              active={folder.kind === "mailbox" && folder.mailboxId === mailbox.id}
              onSelect={() =>
                selectFolder({ kind: "mailbox", mailboxId: mailbox.id, accountId: account.id })
              }
            />
          ))}
        </div>
      )}

      <RemoveAccountDialog account={account} open={confirmRemove} onOpenChange={setConfirmRemove} />
    </div>
  );
}
