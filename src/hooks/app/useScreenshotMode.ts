import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { dropTargetKey, quoteHtml } from "@lib";
import type { Conversation } from "@models";
import { mailboxesService, messagesService } from "@services";
import { rowOf, useComposerStore, useDragStore, useMailStore, useSettingsStore } from "@stores";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens the right-click menu of an element, as a right click at its center would. */
function rightClick(element: Element | null) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  element.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: rect.left + rect.width * 0.35,
      clientY: rect.top + rect.height / 2,
    }),
  );
}

const replyHtml =
  "<p>Count me in! Here's what I'm bringing:</p>" +
  "<ul><li><p><strong>Binoculars</strong> (the new 10×42 ones)</p></li>" +
  "<li><p>Coffee, <em>a lot of it</em></p></li></ul>" +
  '<p>The park rules are <a href="https://rasodacatarina.example">on their site</a>, worth a read before Saturday.</p>';

/**
 * Development only (scripts/screenshots.sh): URL parameters set up the UI without clicking.
 * `?screenshot&theme=dark&lang=pt-BR&open=0&scene=reader` applies the theme and language, opens
 * the n-th conversation once the list has loaded and stages a scene:
 * - `reader` (default): just the open conversation;
 * - `composer`: a formatted reply to it;
 * - `selection`: three conversations selected, with the right-click menu open;
 * - `drag`: two conversations being dragged onto a folder;
 * - `folders`: the right-click menu of a custom folder.
 * Removed from production builds.
 */
export function useScreenshotMode(conversations: Conversation[]) {
  const { t, i18n } = useTranslation("mail");
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
    if (conversation) useMailStore.getState().selectMessage(rowOf(conversation));

    const stage = async () => {
      await wait(1500); // let the reader, sidebar and translations settle
      const mail = useMailStore.getState();
      switch (params.get("scene") ?? "reader") {
        case "composer": {
          if (!conversation) return;
          const original = await messagesService.get(conversation.id);
          useComposerStore.getState().open({
            accountId: conversation.accountId,
            to: conversation.fromAddress,
            subject: conversation.subject.startsWith("Re:")
              ? conversation.subject
              : `Re: ${conversation.subject}`,
            body:
              replyHtml +
              quoteHtml(
                conversation.fromName ?? conversation.fromAddress,
                original?.bodyText ?? conversation.snippet,
              ),
          });
          return;
        }
        case "selection": {
          const rows = conversations.slice(1, 4).map(rowOf);
          mail.selectRange(rows, rows[1].id);
          await wait(500);
          rightClick(document.querySelector(`[data-message-id="${rows[1].id}"]`));
          return;
        }
        case "drag": {
          // Two conversations of the first account, dragged onto one of its custom folders.
          const accountId = conversations[0].accountId;
          const rows = conversations.filter((item) => item.accountId === accountId).slice(1, 3);
          const folders = await mailboxesService.list();
          const target = folders.find(
            (folder) => folder.accountId === accountId && folder.role === "custom",
          );
          if (rows.length < 2 || !target) return;
          mail.selectRange(rows.map(rowOf), rows[1].id);
          const key = dropTargetKey({ kind: "mailbox", mailboxId: target.id });
          const rect = document
            .querySelector(`[data-drop-target="${CSS.escape(key)}"]`)
            ?.getBoundingClientRect();
          if (!rect) return;
          const drag = useDragStore.getState();
          drag.start({ rows: rows.map(rowOf), label: t("drag.count", { count: rows.length }) });
          drag.move({ x: rect.left + rect.width * 0.55, y: rect.top + rect.height * 0.6 }, key);
          return;
        }
        case "folders": {
          const folders = await mailboxesService.list();
          const target = folders.find((folder) => folder.role === "custom");
          if (!target) return;
          const key = dropTargetKey({ kind: "mailbox", mailboxId: target.id });
          rightClick(document.querySelector(`[data-drop-target="${CSS.escape(key)}"]`));
          return;
        }
      }
    };
    void stage();
  }, [conversations, i18n, t]);
}
