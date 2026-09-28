import { create } from "zustand";

import type { FolderSelection } from "@models";

interface MailState {
  folder: FolderSelection;
  /** Newest message of the selected row (a conversation or a single message). */
  selectedMessageId: string | null;
  /** All messages the selected row stands for in the current folder. */
  selectedIds: string[];
  searchQuery: string;
  selectFolder: (folder: FolderSelection) => void;
  selectMessage: (messageId: string | null, ids?: string[]) => void;
  setSearchQuery: (query: string) => void;
}

export const useMailStore = create<MailState>()((set) => ({
  folder: { kind: "unified", role: "inbox" },
  selectedMessageId: null,
  selectedIds: [],
  searchQuery: "",
  selectFolder: (folder) =>
    set({ folder, selectedMessageId: null, selectedIds: [], searchQuery: "" }),
  selectMessage: (selectedMessageId, ids) =>
    set({ selectedMessageId, selectedIds: ids ?? (selectedMessageId ? [selectedMessageId] : []) }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
