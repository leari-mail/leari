import { useTranslation } from "react-i18next";

import { useMailboxes } from "@hooks/mailboxes/useMailboxes";
import { useConfirmStore, useMailStore } from "@stores";

import { useConversations } from "./useConversations";
import { type MoveTarget, useMoveMessage } from "./useMoveMessage";
import { useSetMessageRead } from "./useSetMessageRead";
import { useSetMessageStarred } from "./useSetMessageStarred";

/**
 * Actions on the message list's selection (one or more rows), shared by the context menu, the
 * multi-selection pane, the reader toolbar and keyboard shortcuts.
 */
export function useMessageActions() {
  const { t } = useTranslation("mail");
  const rows = useMailStore((state) => state.selectedRows);
  const ids = useMailStore((state) => state.selectedIds);
  const folder = useMailStore((state) => state.folder);
  const { data: mailboxes = [] } = useMailboxes();
  const { conversations } = useConversations();
  const confirm = useConfirmStore((state) => state.confirm);
  const move = useMoveMessage();
  const setRead = useSetMessageRead();
  const setStarred = useSetMessageStarred();

  const role =
    folder.kind === "unified"
      ? folder.role
      : mailboxes.find((mailbox) => mailbox.id === folder.mailboxId)?.role;
  const selected = conversations.filter((conversation) =>
    rows.some((row) => row.id === conversation.id),
  );
  const count = rows.length;
  const moveTo = (to: MoveTarget) => move.mutateAsync({ ids, to });

  return {
    count,
    /** The folder the selection is in (its role; "custom" for your own folders). */
    role,
    anyUnread: selected.some((conversation) => conversation.unreadCount > 0),
    allStarred: selected.length > 0 && selected.every((conversation) => conversation.starred),

    archive: () => void moveTo("archive"),
    /** To Trash; from the trash it deletes permanently, after confirming. */
    remove: () => {
      if (count === 0) return;
      if (role !== "trash") return void moveTo("trash");
      confirm({
        title: t("actions.deleteTitle", { count }),
        description: t("actions.deleteDescription", { count }),
        confirmLabel: t("actions.deletePermanently"),
        onConfirm: () => moveTo("trash"),
      });
    },
    moveTo: (mailboxId: string) => void moveTo({ mailboxId }),
    moveToRole: (target: "inbox" | "archive" | "spam" | "trash") => void moveTo(target),
    spam: () => void moveTo(role === "spam" ? "inbox" : "spam"),
    setRead: (isRead: boolean) => setRead.mutate({ ids, isRead }),
    setStarred: (isStarred: boolean) => setStarred.mutate({ ids, isStarred }),
  };
}
