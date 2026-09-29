import { useTranslation } from "react-i18next";

import type { Mailbox } from "@models";

/** A folder's display name: translated for special folders, the server's name for your own. */
export function useMailboxLabel() {
  const { t } = useTranslation("mail");
  return (mailbox: Pick<Mailbox, "role" | "name">) =>
    mailbox.role === "custom" ? mailbox.name : t(`folders.${mailbox.role}`);
}
