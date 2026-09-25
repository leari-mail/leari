import type { MailboxRole } from "@models";
import { useTranslation } from "react-i18next";

import { useUnifiedUnreadCount } from "@hooks";
import { useMailStore } from "@stores";

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

  return (
    <MailboxItem
      role={role}
      label={t(`unified.${role}`)}
      count={role === "inbox" ? unread : 0}
      active={active}
      onSelect={() => selectFolder({ kind: "unified", role })}
    />
  );
}
