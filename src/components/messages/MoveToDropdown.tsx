import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { MailboxIcon } from "@components/mailboxes";
import { useMailboxLabel, useMessageActions, useMoveTargets } from "@hooks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui";

interface MoveToDropdownProps {
  /** The button that opens the menu. */
  children: ReactNode;
}

/** "Move to" as a dropdown (reader toolbar, multi-selection pane). */
export function MoveToDropdown({ children }: MoveToDropdownProps) {
  const { t } = useTranslation("mail");
  const targets = useMoveTargets();
  const actions = useMessageActions();
  const label = useMailboxLabel();
  if (targets.kind === "none") return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 min-w-44 overflow-y-auto">
        {targets.kind === "roles" &&
          targets.roles.map((role) => (
            <DropdownMenuItem key={role} onSelect={() => actions.moveToRole(role)}>
              <MailboxIcon role={role} />
              {t(`folders.${role}`)}
            </DropdownMenuItem>
          ))}
        {targets.kind === "mailboxes" && targets.folders.length === 0 && (
          <DropdownMenuItem disabled>{t("actions.noFolders")}</DropdownMenuItem>
        )}
        {targets.kind === "mailboxes" &&
          targets.folders.map(({ mailbox, depth }) => (
            <DropdownMenuItem
              key={mailbox.id}
              style={{ paddingLeft: `${0.5 + depth * 0.875}rem` }}
              onSelect={() => actions.moveTo(mailbox.id)}
            >
              <MailboxIcon role={mailbox.role} />
              <span className="truncate">{label(mailbox)}</span>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
