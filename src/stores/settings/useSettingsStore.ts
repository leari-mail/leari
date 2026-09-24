import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  markAsReadOnOpen: boolean;
  setTheme: (theme: Theme) => void;
  setMarkAsReadOnOpen: (value: boolean) => void;
}

/** User preferences persisted locally. Language is persisted by i18next itself. */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      markAsReadOnOpen: true,
      setTheme: (theme) => set({ theme }),
      setMarkAsReadOnOpen: (markAsReadOnOpen) => set({ markAsReadOnOpen }),
    }),
    { name: "leari.settings", storage: createJSONStorage(() => localStorage) },
  ),
);
