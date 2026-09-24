import { create } from "zustand";

export type DialogId = "addAccount" | "settings";

interface DialogState {
  open: DialogId | null;
  openDialog: (id: DialogId) => void;
  closeDialog: () => void;
}

export const useDialogStore = create<DialogState>()((set) => ({
  open: null,
  openDialog: (open) => set({ open }),
  closeDialog: () => set({ open: null }),
}));
