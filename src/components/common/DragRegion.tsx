import type { ReactNode } from "react";
import { cn } from "@lib/utils";

interface DragRegionProps {
  children?: ReactNode;
  className?: string;
}

/** Top bar area that moves the window (the native title bar is hidden on macOS). */
export function DragRegion({ children, className }: DragRegionProps) {
  return (
    <div data-tauri-drag-region className={cn("flex h-13 shrink-0 items-center", className)}>
      {children}
    </div>
  );
}
