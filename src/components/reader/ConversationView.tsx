import { useEffect, useEffectEvent, useState } from "react";

import { useSetMessageRead } from "@hooks";
import type { Account, Message } from "@models";
import { useSettingsStore } from "@stores";
import { ScrollArea } from "@ui";

import { ConversationHeader } from "./ConversationHeader";
import { ConversationMessage } from "./ConversationMessage";
import { ReaderToolbar } from "./ReaderToolbar";

interface ConversationViewProps {
  /** Oldest first. */
  messages: Message[];
  account?: Account;
  showAccount: boolean;
}

/**
 * The reader's content for a selected row. Mounted per selection (`key`), so expansion
 * state starts fresh: the newest and unread messages open, the rest collapsed.
 */
export function ConversationView({ messages, account, showAccount }: ConversationViewProps) {
  const markAsReadOnOpen = useSettingsStore((state) => state.markAsReadOnOpen);
  const { mutate: setRead } = useSetMessageRead();
  const newest = messages[messages.length - 1];

  const [expanded, setExpanded] = useState(
    () => new Set([newest.id, ...messages.filter((m) => !m.isRead).map((m) => m.id)]),
  );
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Opening a conversation reads it (once per selection, so "mark as unread" sticks).
  const markRead = useEffectEvent(() => {
    const unread = messages.filter((message) => !message.isRead).map((message) => message.id);
    if (markAsReadOnOpen && unread.length > 0) setRead({ ids: unread, isRead: true });
  });
  useEffect(() => markRead(), []);

  // Replies go to the newest message someone else sent (not your own reply).
  const ownAddress = account?.email.toLowerCase();
  const replyTo =
    [...messages].reverse().find((message) => message.fromAddress.toLowerCase() !== ownAddress) ??
    newest;
  const single = messages.length === 1;

  return (
    <section className="flex h-full flex-col bg-background">
      <ReaderToolbar messages={messages} replyTo={replyTo} />
      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto max-w-3xl space-y-4 px-8 py-6">
          <ConversationHeader
            subject={messages[0].subject}
            count={messages.length}
            account={showAccount ? account : undefined}
          />
          {messages.map((message) => (
            <ConversationMessage
              key={message.id}
              message={message}
              expanded={single || expanded.has(message.id)}
              onToggle={single ? undefined : () => toggle(message.id)}
            />
          ))}
        </article>
      </ScrollArea>
    </section>
  );
}
