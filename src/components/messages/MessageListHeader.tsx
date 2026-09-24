import { useTranslation } from "react-i18next";
import { DragRegion } from "@components/common";
import { useFolderTitle } from "@hooks";
import { MessageSearch } from "./MessageSearch";

interface MessageListHeaderProps {
  unread: number;
}

export function MessageListHeader({ unread }: MessageListHeaderProps) {
  const { t } = useTranslation("mail");
  const { title, subtitle } = useFolderTitle();

  return (
    <div className="shrink-0 space-y-2 border-b border-border/70 px-3 pb-2.5">
      <DragRegion className="h-12 items-end">
        <div data-tauri-drag-region className="min-w-0 flex-1">
          <h1 data-tauri-drag-region className="truncate text-base leading-tight font-semibold">
            {title}
          </h1>
          <p data-tauri-drag-region className="truncate text-xs text-muted-foreground">
            {unread > 0 ? t("list.unreadCount", { count: unread }) : subtitle}
            {unread > 0 && subtitle ? ` · ${subtitle}` : null}
          </p>
        </div>
      </DragRegion>
      <MessageSearch />
    </div>
  );
}
