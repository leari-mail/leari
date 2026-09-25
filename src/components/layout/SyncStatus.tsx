import { CircleAlert, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAccounts, useNow, useSyncSummary } from "@hooks";
import { cn, formatRelative } from "@lib";

const JUST_NOW_MS = 60_000;

/** One-line sync state for the sidebar footer: syncing, failures, or when mail was last updated. */
export function SyncStatus() {
  const { t, i18n } = useTranslation("mail");
  const summary = useSyncSummary();
  const { data: accounts = [] } = useAccounts();
  const now = useNow();

  const { syncing, failed } = summary;
  // Before this session's first sync completes, fall back to the times saved in the database.
  const savedTimes = accounts.map((account) => account.lastSyncedAt?.getTime() ?? 0);
  const lastSyncedAt = summary.lastSyncedAt ?? (Math.max(0, ...savedTimes) || null);

  let label: string;
  if (syncing) label = t("sync.syncing");
  else if (failed > 0) label = t("sync.failedCount", { count: failed });
  else if (!lastSyncedAt) label = t("sync.never");
  else if (now - lastSyncedAt < JUST_NOW_MS) label = t("sync.updatedJustNow");
  else label = t("sync.updated", { time: formatRelative(lastSyncedAt, now, i18n.language) });

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[11px]",
        failed > 0 && !syncing ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {syncing ? (
        <RefreshCw className="size-3 shrink-0 animate-spin" />
      ) : (
        failed > 0 && <CircleAlert className="size-3 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
