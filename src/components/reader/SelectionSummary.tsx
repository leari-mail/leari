import { Archive, FolderInput, Layers, MailOpen, OctagonAlert, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DragRegion, EmptyState } from "@components/common";
import { MoveToDropdown } from "@components/messages";
import { useMessageActions } from "@hooks";
import { useMailStore } from "@stores";
import { Button } from "@ui";

/** The reader with several conversations selected: what's selected and what to do with it. */
export function SelectionSummary() {
  const { t } = useTranslation("mail");
  const actions = useMessageActions();
  const clear = () => useMailStore.getState().selectMessage(null);

  return (
    <section className="flex h-full flex-col bg-background">
      <DragRegion />
      <EmptyState
        className="pb-20"
        icon={<Layers />}
        title={t("selection.count", { count: actions.count })}
        description={t("selection.hint")}
        action={
          <div className="flex max-w-md flex-col items-center gap-3 pt-2">
            <div className="flex flex-wrap justify-center gap-2">
              {actions.role !== "archive" && (
                <Button variant="outline" size="sm" onClick={actions.archive}>
                  <Archive />
                  {t("actions.archive")}
                </Button>
              )}
              <MoveToDropdown>
                <Button variant="outline" size="sm">
                  <FolderInput />
                  {t("actions.moveTo")}
                </Button>
              </MoveToDropdown>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.setRead(actions.anyUnread)}
              >
                <MailOpen />
                {actions.anyUnread ? t("actions.markRead") : t("actions.markUnread")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.setStarred(!actions.allStarred)}
              >
                <Star />
                {actions.allStarred ? t("actions.unstar") : t("actions.star")}
              </Button>
              <Button variant="outline" size="sm" onClick={actions.spam}>
                <OctagonAlert />
                {actions.role === "spam" ? t("actions.notSpam") : t("actions.spam")}
              </Button>
              <Button variant="destructive" size="sm" onClick={actions.remove}>
                <Trash2 />
                {actions.role === "trash" ? t("actions.deletePermanently") : t("actions.delete")}
              </Button>
            </div>
            <Button variant="link" size="sm" className="text-muted-foreground" onClick={clear}>
              {t("selection.clear")}
            </Button>
          </div>
        }
      />
    </section>
  );
}
