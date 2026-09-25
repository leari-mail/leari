import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

import { useComposerStore } from "@stores";

/** Reacts to actions triggered from the menu bar / tray icon menu. */
export function useTrayEvents() {
  useEffect(() => {
    const unlisten = listen("tray://compose", () => useComposerStore.getState().open());
    return () => {
      void unlisten.then((stop) => stop());
    };
  }, []);
}
