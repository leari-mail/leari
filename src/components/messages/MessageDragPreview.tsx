import { Mail } from "lucide-react";
import { createPortal } from "react-dom";

import { useDragStore } from "@stores";

/** The chip that follows the pointer while messages are dragged to a folder. */
export function MessageDragPreview() {
  const drag = useDragStore((state) => state.drag);
  const pointer = useDragStore((state) => state.pointer);
  if (!drag) return null;

  return createPortal(
    <div
      aria-hidden
      style={{ transform: `translate(${pointer.x + 14}px, ${pointer.y + 10}px)` }}
      className="pointer-events-none fixed top-0 left-0 z-50 flex max-w-64 items-center gap-2 rounded-lg border border-border/70 bg-popover px-2.5 py-1.5 text-[13px] text-popover-foreground shadow-lg"
    >
      <Mail className="size-3.5 shrink-0 text-primary" />
      <span className="truncate">{drag.label}</span>
      {drag.rows.length > 1 && (
        <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
          {drag.rows.length}
        </span>
      )}
    </div>,
    document.body,
  );
}
