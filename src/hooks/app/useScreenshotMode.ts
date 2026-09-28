import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { Conversation } from "@models";
import { useMailStore, useSettingsStore } from "@stores";

/**
 * Development only (scripts/screenshots.sh): URL parameters set up the UI without clicking.
 * `?screenshot&theme=dark&lang=pt-BR&open=0` applies the theme and language and opens the
 * n-th conversation once the list has loaded. Removed from production builds.
 */
export function useScreenshotMode(conversations: Conversation[]) {
  const { i18n } = useTranslation();
  const applied = useRef(false);

  useEffect(() => {
    if (!import.meta.env.DEV || applied.current || conversations.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has("screenshot")) return;
    applied.current = true;

    const theme = params.get("theme");
    if (theme === "light" || theme === "dark") useSettingsStore.getState().setTheme(theme);
    const lang = params.get("lang");
    if (lang) void i18n.changeLanguage(lang);
    const open = Number(params.get("open"));
    const conversation = Number.isInteger(open) ? conversations[open] : undefined;
    if (conversation)
      useMailStore.getState().selectMessage(conversation.id, conversation.messageIds);
  }, [conversations, i18n]);
}
