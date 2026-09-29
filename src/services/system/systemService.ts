import { invoke } from "@tauri-apps/api/core";

/** Menu bar / tray and notification integration (src-tauri/src/tray.rs, notify.rs). */
export const systemService = {
  /** Unread count next to the tray icon; 0 hides it. */
  setTrayUnread: (count: number) => invoke<void>("tray_set_unread", { count }),

  configureNotifications: (enabled: boolean, language: string) =>
    invoke<void>("notifications_configure", { enabled, language }),

  /** Dock (macOS) / taskbar icon, in addition to the menu bar / tray. */
  setDockVisible: (visible: boolean) => invoke<void>("app_set_dock_visible", { visible }),
};
