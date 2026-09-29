import { FolderPen, FolderPlus, MailOpen, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateMailbox,
  useDeleteMailbox,
  useFolderContents,
  useMailboxes,
  useMailboxLabel,
  useRenameMailbox,
} from "@hooks";
import type { Account, Mailbox } from "@models";
import { useConfirmStore } from "@stores";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@ui";

import { FolderNameDialog } from "./FolderNameDialog";

interface MailboxMenuProps {
  mailbox: Mailbox;
  account: Account;
  /** The sidebar row (right-click target). */
  children: ReactNode;
}

/** Right-click menu of an account's folder: mark all read, empty, new subfolder, rename, delete. */
export function MailboxMenu({ mailbox, account, children }: MailboxMenuProps) {
  const { t } = useTranslation(["mail", "common"]);
  const label = useMailboxLabel();
  const name = label(mailbox);
  const { data: mailboxes = [] } = useMailboxes();
  const confirm = useConfirmStore((state) => state.confirm);
  const contents = useFolderContents();
  const create = useCreateMailbox();
  const rename = useRenameMailbox();
  const remove = useDeleteMailbox();
  const [dialog, setDialog] = useState<"subfolder" | "rename" | null>(null);

  // POP3 accounts have no server folders; special folders keep their names and can't be deleted.
  const manageable = account.incomingProtocol === "imap" && mailbox.role === "custom";
  const hasTrash = mailboxes.some((item) => item.accountId === account.id && item.role === "trash");
  const permanent = mailbox.role === "trash" || mailbox.role === "spam" || !hasTrash;
  const emptyLabel =
    mailbox.role === "trash"
      ? t("mail:folderMenu.emptyTrash")
      : mailbox.role === "spam"
        ? t("mail:folderMenu.emptySpam")
        : t("mail:folderMenu.empty");

  const empty = () =>
    confirm({
      title: t("mail:folderMenu.emptyTitle", { name }),
      description: permanent
        ? t("mail:folderMenu.emptyPermanent")
        : t("mail:folderMenu.emptyToTrash"),
      confirmLabel: t("mail:folderMenu.emptyConfirm"),
      onConfirm: () => contents.empty.mutateAsync([mailbox.id]),
    });
  const deleteFolder = () =>
    confirm({
      title: t("mail:folderMenu.deleteTitle", { name }),
      description: t("mail:folderMenu.deleteDescription"),
      confirmLabel: t("mail:actions.delete"),
      onConfirm: () => remove.mutateAsync({ accountId: account.id, mailboxId: mailbox.id }),
    });

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-48">
          <ContextMenuItem onSelect={() => contents.markAllRead.mutate([mailbox.id])}>
            <MailOpen />
            {t("mail:folderMenu.markAllRead")}
          </ContextMenuItem>
          {manageable && (
            <>
              <ContextMenuItem onSelect={() => setDialog("subfolder")}>
                <FolderPlus />
                {t("mail:folderMenu.newSubfolder")}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => setDialog("rename")}>
                <FolderPen />
                {t("mail:folderMenu.rename")}
              </ContextMenuItem>
            </>
          )}
          {mailbox.role !== "drafts" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant={permanent ? "destructive" : "default"} onSelect={empty}>
                <Trash2 />
                {emptyLabel}
              </ContextMenuItem>
            </>
          )}
          {manageable && (
            <ContextMenuItem variant="destructive" onSelect={deleteFolder}>
              <Trash2 />
              {t("mail:folderMenu.delete")}
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <FolderNameDialog
        open={dialog === "subfolder"}
        title={t("mail:folderMenu.newIn", { name })}
        submitLabel={t("mail:folderMenu.create")}
        onOpenChange={(open) => setDialog(open ? "subfolder" : null)}
        onSubmit={(folderName) =>
          create.mutateAsync({ accountId: account.id, parentId: mailbox.id, name: folderName })
        }
      />
      <FolderNameDialog
        open={dialog === "rename"}
        title={t("mail:folderMenu.renameTitle")}
        submitLabel={t("common:actions.save")}
        initialName={mailbox.name}
        onOpenChange={(open) => setDialog(open ? "rename" : null)}
        onSubmit={(folderName) =>
          rename.mutateAsync({ accountId: account.id, mailboxId: mailbox.id, name: folderName })
        }
      />
    </>
  );
}
