import { Archive, MailOpen, OctagonAlert, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMessageActions } from "@hooks";
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@ui";

import { MoveToSubmenu } from "./MoveToSubmenu";

/** Right-click menu for the selected message-list rows. */
export function MessageActionsMenu() {
  const { t } = useTranslation("mail");
  const actions = useMessageActions();
  if (actions.count === 0) return null;

  return (
    <ContextMenuContent className="min-w-48">
      <ContextMenuItem onSelect={() => actions.setRead(actions.anyUnread)}>
        <MailOpen />
        {actions.anyUnread ? t("actions.markRead") : t("actions.markUnread")}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => actions.setStarred(!actions.allStarred)}>
        <Star />
        {actions.allStarred ? t("actions.unstar") : t("actions.star")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      {actions.role !== "archive" && (
        <ContextMenuItem onSelect={actions.archive}>
          <Archive />
          {t("actions.archive")}
        </ContextMenuItem>
      )}
      <MoveToSubmenu />
      <ContextMenuItem onSelect={actions.spam}>
        <OctagonAlert />
        {actions.role === "spam" ? t("actions.notSpam") : t("actions.spam")}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" onSelect={actions.remove}>
        <Trash2 />
        {actions.role === "trash" ? t("actions.deletePermanently") : t("actions.delete")}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
