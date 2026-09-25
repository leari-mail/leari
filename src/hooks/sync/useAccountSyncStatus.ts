import type { SyncStatus } from "@models";

import { useSyncStore } from "@stores";

export function useAccountSyncStatus(accountId: string): SyncStatus | undefined {
  return useSyncStore((state) => state.statuses[accountId]);
}
