import { useSyncStore } from "@stores";

/** True while any account is syncing. */
export function useIsSyncing(): boolean {
  return useSyncStore((state) =>
    Object.values(state.statuses).some((status) => status.state === "syncing"),
  );
}
