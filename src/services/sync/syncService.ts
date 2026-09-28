import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { ConnectionSecurity, SyncStatus } from "@models";

export interface ServerConfig {
  host: string;
  port: number;
  security: ConnectionSecurity;
}

/** Wrappers around the Rust sync engine (src-tauri/src/sync). */
export const syncService = {
  /** Starts periodic background sync. Call once the database is migrated. */
  start: () => invoke<void>("sync_start"),

  /** Full sync of one account, or of all accounts. */
  syncNow: (accountId?: string) => invoke<void>("sync_now", { accountId }),

  /** Pushes an account's queued local changes (read, star, move, delete). */
  push: (accountId: string) => invoke<void>("sync_push", { accountId }),

  statuses: () => invoke<SyncStatus[]>("sync_statuses"),

  /** Checks the incoming server login (IMAP or POP3) before an account is saved. */
  testConnection: (
    protocol: "imap" | "pop3",
    server: ServerConfig,
    username: string,
    password: string,
  ) => invoke<void>(`${protocol}_test_connection`, { server, username, password }),

  onStatus: (handler: (status: SyncStatus) => void): Promise<UnlistenFn> =>
    listen<SyncStatus>("sync://status", (event) => handler(event.payload)),

  onChanged: (handler: (accountId: string) => void): Promise<UnlistenFn> =>
    listen<{ accountId: string }>("sync://changed", (event) => handler(event.payload.accountId)),
};
