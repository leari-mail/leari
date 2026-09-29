import { useEffect } from "react";

import { systemService } from "@services";
import { useSettingsStore } from "@stores";

/** Applies the "Show in Dock / taskbar" setting. */
export function useDockVisibility() {
  const visible = useSettingsStore((state) => state.showInDock);

  useEffect(() => {
    void systemService.setDockVisible(visible);
  }, [visible]);
}
