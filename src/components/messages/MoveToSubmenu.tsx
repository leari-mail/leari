import { FolderInput } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MailboxIcon } from "@components/mailboxes";
import { useMailboxLabel, useMessageActions, useMoveTargets } from "@hooks";
import { ContextMenuItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@ui";

/** "Move to" in the message context menu: the account's folders, nested. */
export function MoveToSubmenu() {
  const { t } = useTranslation("mail");
  const targets = useMoveTargets();
  const actions = useMessageActions();
  const label = useMailboxLabel();
  if (targets.kind === "none") return null;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className="gap-2">
        <FolderInput className="size-4 text-muted-foreground" />
        {t("actions.moveTo")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="max-h-80 min-w-44 overflow-y-auto">
        {targets.kind === "roles" &&
          targets.roles.map((role) => (
            <ContextMenuItem key={role} onSelect={() => actions.moveToRole(role)}>
              <MailboxIcon role={role} />
              {t(`folders.${role}`)}
            </ContextMenuItem>
          ))}
        {targets.kind === "mailboxes" && targets.folders.length === 0 && (
          <ContextMenuItem disabled>{t("actions.noFolders")}</ContextMenuItem>
        )}
        {targets.kind === "mailboxes" &&
          targets.folders.map(({ mailbox, depth }) => (
            <ContextMenuItem
              key={mailbox.id}
              style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
              onSelect={() => actions.moveTo(mailbox.id)}
            >
              <MailboxIcon role={mailbox.role} />
              <span className="truncate">{label(mailbox)}</span>
            </ContextMenuItem>
          ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
