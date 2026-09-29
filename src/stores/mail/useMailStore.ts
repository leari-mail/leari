import { create } from "zustand";

import type { FolderSelection } from "@models";

/** A selected row of the message list: a conversation (or a single message). */
export interface SelectedRow {
  /** The row's id: its newest message in the listed folder. */
  id: string;
  accountId: string;
  /** Ids of the row's messages in the listed folder. */
  messageIds: string[];
}

interface MailState {
  folder: FolderSelection;
  /** Rows selected in the message list, in the order they were added. */
  selectedRows: SelectedRow[];
  /** The row shown in the reader (the last one clicked); null with no selection. */
  selectedMessageId: string | null;
  /** Every message the selected rows stand for. */
  selectedIds: string[];
  /** Where ⇧-click and ⇧↑/↓ ranges start. */
  anchorId: string | null;
  searchQuery: string;
  selectFolder: (folder: FolderSelection) => void;
  /** Selects one row (or clears the selection with null). */
  selectMessage: (row: SelectedRow | null) => void;
  /** Adds a row to the selection, or removes it (⌘-click). */
  toggleRow: (row: SelectedRow) => void;
  /** Replaces the selection with a range; the anchor stays put. */
  selectRange: (rows: SelectedRow[], currentId: string) => void;
  setSearchQuery: (query: string) => void;
}

/** The selection entry for a message-list row (a conversation). */
export function rowOf(row: { id: string; accountId: string; messageIds: string[] }): SelectedRow {
  return { id: row.id, accountId: row.accountId, messageIds: row.messageIds };
}

const empty = { selectedRows: [], selectedMessageId: null, selectedIds: [], anchorId: null };

function withRows(rows: SelectedRow[], currentId: string | null) {
  return {
    selectedRows: rows,
    selectedMessageId: currentId,
    selectedIds: [...new Set(rows.flatMap((row) => row.messageIds))],
  };
}

export const useMailStore = create<MailState>()((set) => ({
  folder: { kind: "unified", role: "inbox" },
  ...empty,
  searchQuery: "",
  selectFolder: (folder) => set({ folder, ...empty, searchQuery: "" }),
  selectMessage: (row) => set(row ? { ...withRows([row], row.id), anchorId: row.id } : empty),
  toggleRow: (row) =>
    set((state) => {
      const selected = state.selectedRows.some((item) => item.id === row.id);
      if (!selected) return { ...withRows([...state.selectedRows, row], row.id), anchorId: row.id };
      const rows = state.selectedRows.filter((item) => item.id !== row.id);
      return rows.length ? withRows(rows, rows[rows.length - 1].id) : empty;
    }),
  selectRange: (rows, currentId) => set(withRows(rows, currentId)),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));
