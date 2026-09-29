import { MailOpen, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFolderContents, useMailboxes, useUnifiedUnreadCount } from "@hooks";
import { dropTargetKey } from "@lib";
import type { MailboxRole } from "@models";
import { useConfirmStore, useMailStore } from "@stores";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@ui";

import { MailboxItem } from "./MailboxItem";

interface UnifiedFolderItemProps {
  role: MailboxRole;
}

export function UnifiedFolderItem({ role }: UnifiedFolderItemProps) {
  const { t } = useTranslation("mail");
  const unread = useUnifiedUnreadCount(role);
  const active = useMailStore(
    (state) => state.folder.kind === "unified" && state.folder.role === role,
  );
  const selectFolder = useMailStore((state) => state.selectFolder);
  const { data: mailboxes = [] } = useMailboxes();
  const contents = useFolderContents();
  const confirm = useConfirmStore((state) => state.confirm);

  // Starred is a view across folders, not a folder of its own.
  const ids = mailboxes.filter((mailbox) => mailbox.role === role).map((mailbox) => mailbox.id);
  const item = (
    <MailboxItem
      role={role}
      label={t(`unified.${role}`)}
      count={role === "inbox" ? unread : 0}
      active={active}
      dropTarget={dropTargetKey({ kind: "role", role })}
      onSelect={() => selectFolder({ kind: "unified", role })}
    />
  );
  if (role === "starred" || ids.length === 0) return item;

  const emptyTrash = () =>
    confirm({
      title: t("folderMenu.emptyTitle", { name: t(`unified.${role}`) }),
      description: t("folderMenu.emptyPermanent"),
      confirmLabel: t("folderMenu.emptyConfirm"),
      onConfirm: () => contents.empty.mutateAsync(ids),
    });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{item}</ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onSelect={() => contents.markAllRead.mutate(ids)}>
          <MailOpen />
          {t("folderMenu.markAllRead")}
        </ContextMenuItem>
        {role === "trash" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={emptyTrash}>
              <Trash2 />
              {t("folderMenu.emptyTrash")}
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
