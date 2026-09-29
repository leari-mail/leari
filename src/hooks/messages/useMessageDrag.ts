import type { PointerEvent } from "react";
import { useTranslation } from "react-i18next";

import { useMailboxes } from "@hooks/mailboxes/useMailboxes";
import { canDrop, parseDropTarget } from "@lib";
import type { Conversation } from "@models";
import { rowOf, useDragStore, useMailStore } from "@stores";

import { useMoveMessage } from "./useMoveMessage";
import { useSetMessageStarred } from "./useSetMessageStarred";

/** How far the pointer moves before a press becomes a drag. */
const THRESHOLD = 5;

/**
 * Dragging message-list rows onto sidebar folders. Built on pointer events rather than HTML5
 * drag and drop, which Tauri's native file drop (used for attachments) takes over on some
 * platforms. Drop targets are elements with a `data-drop-target` key (see `dropTargetKey`).
 */
export function useMessageDrag() {
  const { t } = useTranslation("mail");
  const { data: mailboxes = [] } = useMailboxes();
  const move = useMoveMessage();
  const setStarred = useSetMessageStarred();

  const drop = (key: string | null) => {
    const drag = useDragStore.getState().drag;
    const target = parseDropTarget(key);
    if (!drag || !target) return;
    const ids = [...new Set(drag.rows.flatMap((row) => row.messageIds))];
    if (target.kind === "mailbox") move.mutate({ ids, to: { mailboxId: target.mailboxId } });
    else if (target.role === "starred") setStarred.mutate({ ids, isStarred: true });
    else if (target.role !== "sent" && target.role !== "drafts" && target.role !== "custom")
      move.mutate({ ids, to: target.role });
  };

  /** Pointer-down handler for a list row. */
  return (conversation: Conversation, event: PointerEvent) => {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY };
    let accountIds: string[] = [];
    let dragging = false;

    const targetAt = (x: number, y: number) => {
      const key = document
        .elementFromPoint(x, y)
        ?.closest("[data-drop-target]")
        ?.getAttribute("data-drop-target");
      const target = parseDropTarget(key);
      const { folder } = useMailStore.getState();
      return target && canDrop(target, accountIds, folder, mailboxes) ? (key ?? null) : null;
    };

    const begin = () => {
      dragging = true;
      const { selectedRows, selectMessage } = useMailStore.getState();
      let rows = selectedRows;
      // Dragging a row outside the selection drags just that row (and selects it).
      if (!rows.some((row) => row.id === conversation.id)) {
        rows = [rowOf(conversation)];
        selectMessage(rows[0]);
      }
      accountIds = [...new Set(rows.map((row) => row.accountId))];
      const label =
        rows.length === 1
          ? conversation.subject || t("list.noSubject")
          : t("drag.count", { count: rows.length });
      useDragStore.getState().start({ rows, label });
      document.documentElement.dataset.dragging = "";
    };

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      if (!dragging) {
        const distance = Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y);
        if (distance < THRESHOLD) return;
        begin();
      }
      const pointer = { x: moveEvent.clientX, y: moveEvent.clientY };
      useDragStore.getState().move(pointer, targetAt(pointer.x, pointer.y));
    };

    const finish = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", onKey, true);
      delete document.documentElement.dataset.dragging;
      useDragStore.getState().end();
    };

    const onUp = () => {
      if (dragging) {
        drop(useDragStore.getState().over);
        // Releasing over the row itself would click it (and select only it).
        const swallow = (click: MouseEvent) => click.stopPropagation();
        window.addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", swallow, true), 0);
      }
      finish();
    };

    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape" || !dragging) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      finish();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", onKey, true);
  };
}
