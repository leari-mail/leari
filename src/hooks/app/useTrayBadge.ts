import { useEffect } from "react";

import { useUnifiedUnreadCount } from "@hooks/mailboxes";
import { systemService } from "@services";
import { useSettingsStore } from "@stores";

/** Keeps the menu bar / tray unread count in step with the unified inbox. */
export function useTrayBadge() {
  const unread = useUnifiedUnreadCount("inbox");
  const enabled = useSettingsStore((state) => state.showUnreadInMenuBar);

  useEffect(() => {
    void systemService.setTrayUnread(enabled ? unread : 0);
  }, [enabled, unread]);
}
