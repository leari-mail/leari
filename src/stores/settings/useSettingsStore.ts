import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  markAsReadOnOpen: boolean;
  /** Show conversations (threads) as one row in the list and together in the reader. */
  groupByConversation: boolean;
  /** System notification when new mail arrives. */
  notifyNewMail: boolean;
  /** Unread count next to the menu bar / tray icon. */
  showUnreadInMenuBar: boolean;
  /** Also show leari in the Dock (macOS) / taskbar, like a regular app. */
  showInDock: boolean;
  setTheme: (theme: Theme) => void;
  setMarkAsReadOnOpen: (value: boolean) => void;
  setGroupByConversation: (value: boolean) => void;
  setNotifyNewMail: (value: boolean) => void;
  setShowUnreadInMenuBar: (value: boolean) => void;
  setShowInDock: (value: boolean) => void;
}

/** User preferences persisted locally. Language is persisted by i18next itself. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      markAsReadOnOpen: true,
      groupByConversation: true,
      notifyNewMail: true,
      showUnreadInMenuBar: true,
      showInDock: false,
      setTheme: (theme) => set({ theme }),
      setMarkAsReadOnOpen: (markAsReadOnOpen) => set({ markAsReadOnOpen }),
      setGroupByConversation: (groupByConversation) => set({ groupByConversation }),
      setNotifyNewMail: (notifyNewMail) => set({ notifyNewMail }),
      setShowUnreadInMenuBar: (showUnreadInMenuBar) => set({ showUnreadInMenuBar }),
      setShowInDock: (showInDock) => set({ showInDock }),
    }),
    { name: "leari.settings", storage: createJSONStorage(() => localStorage) },
  ),
);
