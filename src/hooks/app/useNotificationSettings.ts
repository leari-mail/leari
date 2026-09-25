import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { systemService } from "@services";
import { useSettingsStore } from "@stores";

/** Sends the new-mail notification preference (and language for its texts) to Rust. */
export function useNotificationSettings() {
  const { i18n } = useTranslation();
  const enabled = useSettingsStore((state) => state.notifyNewMail);
  const language = i18n.resolvedLanguage ?? "en";

  useEffect(() => {
    void systemService.configureNotifications(enabled, language);
  }, [enabled, language]);
}
