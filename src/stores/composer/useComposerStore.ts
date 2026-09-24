import { create } from "zustand";

export interface Draft {
  accountId?: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
}

const emptyDraft: Draft = { to: "", cc: "", subject: "", body: "" };

interface ComposerState {
  isOpen: boolean;
  draft: Draft;
  open: (draft?: Partial<Draft>) => void;
  update: (changes: Partial<Draft>) => void;
  close: () => void;
}

export const useComposerStore = create<ComposerState>()((set) => ({
  isOpen: false,
  draft: emptyDraft,
  open: (draft) => set({ isOpen: true, draft: { ...emptyDraft, ...draft } }),
  update: (changes) => set((state) => ({ draft: { ...state.draft, ...changes } })),
  close: () => set({ isOpen: false, draft: emptyDraft }),
}));
