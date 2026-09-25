import { create } from "zustand";

import type { FolderSelection } from "@models";

interface MailState {
  folder: FolderSelection;
  selectedMessageId: string | null;
  searchQuery: string;
  selectFolder: (folder: FolderSelection) => void;
  selectMessage: (messageId: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useMailStore = create<MailState>()((set) => ({
  folder: { kind: "unified", role: "inbox" },
  selectedMessageId: null,
  searchQuery: "",
  selectFolder: (folder) => set({ folder, selectedMessageId: null, searchQuery: "" }),
  selectMessage: (selectedMessageId) => set({ selectedMessageId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
