import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DragRegion, IconButton } from "@components/common";
import { useFolderTitle, useIsSyncing, useSyncNow } from "@hooks";
import { cn } from "@lib";
import { useMailStore } from "@stores";

import { MessageSearch } from "./MessageSearch";

interface MessageListHeaderProps {
  unread: number;
}

export function MessageListHeader({ unread }: MessageListHeaderProps) {
  const { t } = useTranslation("mail");
  const { title, subtitle } = useFolderTitle();
  const isSyncing = useIsSyncing();
  const syncNow = useSyncNow();
  const folder = useMailStore((state) => state.folder);

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
        <IconButton
          label={isSyncing ? t("sync.syncing") : t("sync.refresh")}
          icon={<RotateCw className={cn(isSyncing && "animate-spin")} />}
          disabled={isSyncing}
          onClick={() => syncNow.mutate(folder.kind === "mailbox" ? folder.accountId : undefined)}
          className="mb-0.5"
        />
      </DragRegion>
      <MessageSearch />
    </div>
  );
}
