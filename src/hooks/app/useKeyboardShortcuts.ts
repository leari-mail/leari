import { useEffect } from "react";
import { useComposerStore, useDialogStore } from "@stores";

/** Global shortcuts: ⌘N new message, ⌘, settings. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key === "n") {
        event.preventDefault();
        useComposerStore.getState().open();
      } else if (event.key === ",") {
        event.preventDefault();
        useDialogStore.getState().openDialog("settings");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
