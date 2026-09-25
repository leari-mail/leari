import { create } from "zustand";

import type { ComposerAttachment } from "@models";

export interface Draft {
  accountId?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  /** Local id of the message being replied to (threading headers). */
  replyToMessageId?: string;
  attachments: ComposerAttachment[];
}

const emptyDraft: Draft = { to: "", cc: "", bcc: "", subject: "", body: "", attachments: [] };

const key = (attachment: ComposerAttachment) =>
  attachment.kind === "file" ? attachment.path : attachment.attachmentId;

interface ComposerState {
  isOpen: boolean;
  draft: Draft;
  open: (draft?: Partial<Draft>) => void;
  update: (changes: Partial<Draft>) => void;
  /** Adds attachments, skipping ones already attached. */
  attach: (attachments: ComposerAttachment[]) => void;
  detach: (attachment: ComposerAttachment) => void;
  close: () => void;
}

export const useComposerStore = create<ComposerState>()((set) => ({
  isOpen: false,
  draft: emptyDraft,
  open: (draft) => set({ isOpen: true, draft: { ...emptyDraft, ...draft } }),
  update: (changes) => set((state) => ({ draft: { ...state.draft, ...changes } })),
  attach: (attachments) =>
    set((state) => {
      const existing = new Set(state.draft.attachments.map(key));
      const added = attachments.filter((attachment) => !existing.has(key(attachment)));
      return { draft: { ...state.draft, attachments: [...state.draft.attachments, ...added] } };
    }),
  detach: (attachment) =>
    set((state) => ({
      draft: {
        ...state.draft,
        attachments: state.draft.attachments.filter((item) => key(item) !== key(attachment)),
      },
    })),
  close: () => set({ isOpen: false, draft: emptyDraft }),
}));
