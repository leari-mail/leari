import { create } from "zustand";
import type { SyncStatus } from "@models";

interface SyncStoreState {
  statuses: Record<string, SyncStatus>;
  setStatus: (status: SyncStatus) => void;
  setStatuses: (statuses: SyncStatus[]) => void;
}

/** Latest sync status per account, fed by `sync://status` events. */
export const useSyncStore = create<SyncStoreState>()((set) => ({
  statuses: {},
  setStatus: (status) =>
    set((state) => ({ statuses: { ...state.statuses, [status.accountId]: status } })),
  setStatuses: (statuses) =>
    set({ statuses: Object.fromEntries(statuses.map((status) => [status.accountId, status])) }),
}));
