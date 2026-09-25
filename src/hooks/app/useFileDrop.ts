import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useEffectEvent, useState } from "react";

/**
 * Files dragged onto the window (Tauri's native drag & drop, which provides real paths).
 * Returns whether files are currently hovering.
 */
export function useFileDrop(enabled: boolean, onDrop: (paths: string[]) => void): boolean {
  const [hovering, setHovering] = useState(false);
  const handleDrop = useEffectEvent(onDrop);

  useEffect(() => {
    if (!enabled) return;
    const unlisten = getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter" || payload.type === "over") setHovering(true);
      else setHovering(false);
      if (payload.type === "drop" && payload.paths.length > 0) handleDrop(payload.paths);
    });
    return () => {
      setHovering(false);
      void unlisten.then((stop) => stop());
    };
  }, [enabled]);

  return enabled && hovering;
}
