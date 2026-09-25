import { create } from "zustand";

export interface Draft {
  accountId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  /** Local id of the message being replied to (threading headers). */
  replyToMessageId?: string;
}

const emptyDraft: Draft = { to: "", cc: "", bcc: "", subject: "", body: "" };

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
