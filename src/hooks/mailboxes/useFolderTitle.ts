import { useTranslation } from "react-i18next";

import { useAccounts } from "@hooks/accounts";
import { useMailStore } from "@stores";

import { useMailboxes } from "./useMailboxes";

/** Title and subtitle of the folder shown in the message list. */
export function useFolderTitle(): { title: string; subtitle?: string } {
  const { t } = useTranslation("mail");
  const folder = useMailStore((state) => state.folder);
  const { data: mailboxes = [] } = useMailboxes();
  const { data: accounts = [] } = useAccounts();

  if (folder.kind === "unified") return { title: t(`unified.${folder.role}`) };

  const mailbox = mailboxes.find((item) => item.id === folder.mailboxId);
  const account = accounts.find((item) => item.id === folder.accountId);
  if (!mailbox) return { title: "" };

  return {
    title: mailbox.role === "custom" ? mailbox.name : t(`folders.${mailbox.role}`),
    subtitle: account?.email,
  };
}
