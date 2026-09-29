import { create } from "zustand";

import type { SelectedRow } from "@stores/mail/useMailStore";

export interface MessageDrag {
  rows: SelectedRow[];
  /** What the preview under the pointer says: a subject, or a count. */
  label: string;
}

interface DragState {
  drag: MessageDrag | null;
  pointer: { x: number; y: number };
  /** `data-drop-target` key of the valid target under the pointer, if any. */
  over: string | null;
  start: (drag: MessageDrag) => void;
  move: (pointer: { x: number; y: number }, over: string | null) => void;
  end: () => void;
}

/** Messages being dragged from the list onto a sidebar folder (pointer-based, see useMessageDrag). */
export const useDragStore = create<DragState>()((set) => ({
  drag: null,
  pointer: { x: 0, y: 0 },
  over: null,
  start: (drag) => set({ drag }),
  move: (pointer, over) => set({ pointer, over }),
  end: () => set({ drag: null, over: null }),
}));
