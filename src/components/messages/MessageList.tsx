import { Inbox, SearchX } from "lucide-react";
import { type KeyboardEvent, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@components/common";
import { useAccounts, useConversations } from "@hooks";
import { useMailStore } from "@stores";
import { ScrollArea } from "@ui";

import { MessageListHeader } from "./MessageListHeader";
import { MessageListItem } from "./MessageListItem";
import { MessageListSkeleton } from "./MessageListSkeleton";

/** Middle pane: folder header, search and the list of messages. */
export function MessageList() {
  const { t } = useTranslation("mail");
  const { data: messages = [], conversations, isPending } = useConversations();
  const { data: accounts = [] } = useAccounts();
  const isUnified = useMailStore((state) => state.folder.kind === "unified");
  const search = useMailStore((state) => state.searchQuery);
  const selectedId = useMailStore((state) => state.selectedMessageId);
  const selectMessage = useMailStore((state) => state.selectMessage);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  // Account markers only help when a unified folder mixes several accounts.
  const showAccounts = isUnified && accounts.length > 1;
  const unread = messages.filter((message) => !message.isRead).length;

  // ↑/↓ (or k/j) moves the selection through the list.
  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[event.key];
    if (!step || conversations.length === 0) return;
    event.preventDefault();

    const index = conversations.findIndex((conversation) => conversation.id === selectedId);
    const next = conversations[Math.min(Math.max(index + step, 0), conversations.length - 1)];
    selectMessage(next.id, next.messageIds);
    document.querySelector(`[data-message-id="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
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
        <div
          role="listbox"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="space-y-0.5 p-2 outline-none"
        >
          {conversations.map((conversation) => (
            <MessageListItem
              key={conversation.id}
              conversation={conversation}
              account={showAccounts ? accountsById.get(conversation.accountId) : undefined}
              selected={conversation.id === selectedId}
              onSelect={() => selectMessage(conversation.id, conversation.messageIds)}
            />
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <section className="flex h-full flex-col bg-list">
      <MessageListHeader unread={unread} />
      {renderBody()}
    </section>
  );
}
