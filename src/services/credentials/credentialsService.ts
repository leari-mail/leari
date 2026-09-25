import { invoke } from "@tauri-apps/api/core";

/** Account secrets are kept in the OS keychain by the Rust side, never in SQLite. */
export const credentialsService = {
  setPassword: (accountId: string, password: string) =>
    invoke<void>("credentials_set_password", { accountId, password }),

  remove: (accountId: string) => invoke<void>("credentials_delete", { accountId }),
};
