import { create } from "zustand";

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  /** Runs when confirmed; the dialog stays open (showing progress, then any error) until it settles. */
  onConfirm: () => Promise<unknown>;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  /** Asks before a destructive action (delete permanently, empty a folder…). */
  confirm: (request: ConfirmRequest) => void;
  close: () => void;
}

export const useConfirmStore = create<ConfirmState>()((set) => ({
  request: null,
  confirm: (request) => set({ request }),
  close: () => set({ request: null }),
}));
