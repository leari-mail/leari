import { useShallow } from "zustand/react/shallow";

import { useSyncStore } from "@stores";

export interface SyncSummary {
  syncing: boolean;
  failed: number;
  lastSyncedAt: number | null;
}

/** Overall sync state across accounts, for the status line and the refresh button. */
export function useSyncSummary(): SyncSummary {
  return useSyncStore(
    useShallow((state) => {
      const statuses = Object.values(state.statuses);
      const times = statuses.map((status) => status.lastSyncedAt ?? 0).filter(Boolean);
      return {
        syncing: statuses.some((status) => status.state === "syncing"),
        failed: statuses.filter((status) => status.state === "error").length,
        lastSyncedAt: times.length ? Math.max(...times) : null,
      };
    }),
  );
}
