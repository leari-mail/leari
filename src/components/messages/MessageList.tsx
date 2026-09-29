import { Inbox, SearchX } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@components/common";
import {
  useAccounts,
  useConversations,
  useMessageActions,
  useMessageDrag,
  useScreenshotMode,
} from "@hooks";
import type { Conversation } from "@models";
import { rowOf, useDragStore, useMailStore } from "@stores";
import { ContextMenu, ContextMenuTrigger, ScrollArea } from "@ui";

import { MessageActionsMenu } from "./MessageActionsMenu";
import { MessageDragPreview } from "./MessageDragPreview";
import { MessageListHeader } from "./MessageListHeader";
import { MessageListItem } from "./MessageListItem";
import { MessageListSkeleton } from "./MessageListSkeleton";

/** Middle pane: folder header, search and the list of messages. */
export function MessageList() {
  const { t } = useTranslation("mail");
  const { data: messages = [], conversations, isPending } = useConversations();
  useScreenshotMode(conversations);
  const { data: accounts = [] } = useAccounts();
  const isUnified = useMailStore((state) => state.folder.kind === "unified");
  const search = useMailStore((state) => state.searchQuery);
  const currentId = useMailStore((state) => state.selectedMessageId);
  const anchorId = useMailStore((state) => state.anchorId);
  const selectedRows = useMailStore((state) => state.selectedRows);
  const { selectMessage, toggleRow, selectRange } = useMailStore.getState();
  const actions = useMessageActions();
  const startDrag = useMessageDrag();
  const dragged = useDragStore((state) => state.drag?.rows);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const selected = useMemo(() => new Set(selectedRows.map((row) => row.id)), [selectedRows]);
  const draggedIds = useMemo(() => new Set(dragged?.map((row) => row.id)), [dragged]);
  // Account markers only help when a unified folder mixes several accounts.
  const showAccounts = isUnified && accounts.length > 1;
  const unread = messages.filter((message) => !message.isRead).length;

  /** Selects from the anchor (or the given row) to the row at `index`. */
  const selectTo = (index: number) => {
    const anchor = conversations.findIndex((conversation) => conversation.id === anchorId);
    const from = anchor === -1 ? index : anchor;
    const [start, end] = from <= index ? [from, index] : [index, from];
    selectRange(conversations.slice(start, end + 1).map(rowOf), conversations[index].id);
  };

  const onSelect = (conversation: Conversation, index: number, event: MouseEvent) => {
    if (event.metaKey || event.ctrlKey) toggleRow(rowOf(conversation));
    else if (event.shiftKey) selectTo(index);
    else selectMessage(rowOf(conversation));
  };

  // ↑/↓ (or k/j) moves the selection, with ⇧ it extends it; ⌘A selects everything, Esc clears,
  // Delete / ⌫ moves the selection to Trash.
  const onKeyDown = (event: KeyboardEvent) => {
    if (conversations.length === 0) return;
    if ((event.metaKey || event.ctrlKey) && event.key === "a") {
      event.preventDefault();
      selectRange(conversations.map(rowOf), currentId ?? conversations[0].id);
      return;
    }
    if (event.key === "Escape") return selectMessage(null);
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      return actions.remove();
    }

    const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[event.key];
    if (!step || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    const index = conversations.findIndex((conversation) => conversation.id === currentId);
    const nextIndex = Math.min(Math.max(index + step, 0), conversations.length - 1);
    const next = conversations[nextIndex];
    if (event.shiftKey) selectTo(nextIndex);
    else selectMessage(rowOf(next));
    document.querySelector(`[data-message-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  // Right-clicking a row outside the selection selects it first; empty space gets no menu.
  const onContextMenu = (event: MouseEvent) => {
    const id = (event.target as HTMLElement)
      .closest<HTMLElement>("[data-message-id]")
      ?.getAttribute("data-message-id");
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) return event.preventDefault();
    if (!selected.has(conversation.id)) selectMessage(rowOf(conversation));
  };

  const renderBody = () => {
    if (isPending) return <MessageListSkeleton />;
    if (conversations.length === 0) {
      return search ? (
        <EmptyState
          icon={<SearchX />}
          title={t("list.noResultsTitle")}
          description={t("list.noResultsDescription", { query: search })}
        />
      ) : (
        <EmptyState
          icon={<Inbox />}
          title={t("list.emptyTitle")}
          description={t("list.emptyDescription")}
        />
      );
    }
    return (
      <ScrollArea className="min-h-0 flex-1">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              role="listbox"
              aria-multiselectable
              tabIndex={0}
              onKeyDown={onKeyDown}
              onContextMenu={onContextMenu}
              className="space-y-0.5 p-2 outline-none"
            >
              {conversations.map((conversation, index) => (
                <MessageListItem
                  key={conversation.id}
                  conversation={conversation}
                  account={showAccounts ? accountsById.get(conversation.accountId) : undefined}
                  selected={selected.has(conversation.id)}
                  onSelect={(event) => onSelect(conversation, index, event)}
                  onPointerDown={(event) => startDrag(conversation, event)}
                  dragging={draggedIds.has(conversation.id)}
                />
              ))}
            </div>
          </ContextMenuTrigger>
          <MessageActionsMenu />
        </ContextMenu>
      </ScrollArea>
    );
  };

  return (
    <section className="flex h-full flex-col bg-list">
      <MessageListHeader unread={unread} />
      {renderBody()}
      <MessageDragPreview />
    </section>
  );
}
