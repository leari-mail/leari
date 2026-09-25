import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  markAsReadOnOpen: boolean;
  /** System notification when new mail arrives. */
  notifyNewMail: boolean;
  /** Unread count next to the menu bar / tray icon. */
  showUnreadInMenuBar: boolean;
  setTheme: (theme: Theme) => void;
  setMarkAsReadOnOpen: (value: boolean) => void;
  setNotifyNewMail: (value: boolean) => void;
  setShowUnreadInMenuBar: (value: boolean) => void;
}

/** User preferences persisted locally. Language is persisted by i18next itself. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      markAsReadOnOpen: true,
      notifyNewMail: true,
      showUnreadInMenuBar: true,
      setTheme: (theme) => set({ theme }),
      setMarkAsReadOnOpen: (markAsReadOnOpen) => set({ markAsReadOnOpen }),
      setNotifyNewMail: (notifyNewMail) => set({ notifyNewMail }),
      setShowUnreadInMenuBar: (showUnreadInMenuBar) => set({ showUnreadInMenuBar }),
    }),
    { name: "leari.settings", storage: createJSONStorage(() => localStorage) },
  ),
);
