/** Error returned by Rust commands and sync statuses (see src-tauri/src/error.rs). */
export interface AppError {
  kind: "auth" | "network" | "unsupported" | "protocol" | "cancelled" | "other";
  message: string;
}

export type SyncState = "idle" | "syncing" | "error";

export interface SyncStatus {
  accountId: string;
  state: SyncState;
  error: AppError | null;
  lastSyncedAt: number | null;
}

export function isAppError(value: unknown): value is AppError {
  return typeof value === "object" && value !== null && "kind" in value && "message" in value;
}
