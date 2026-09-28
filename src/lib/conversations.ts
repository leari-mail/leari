import type { Conversation, MessageSummary } from "@models";

/** Messages of the same account and thread belong to one conversation. */
export function conversationKey(message: Pick<MessageSummary, "accountId" | "threadId" | "id">) {
  return `${message.accountId}:${message.threadId ?? message.id}`;
}

/**
 * Groups a list of messages (newest first) into conversations, each represented by its
 * newest message, keeping the list's order.
 */
export function groupConversations(messages: MessageSummary[]): Conversation[] {
  const byKey = new Map<string, Conversation>();
  for (const message of messages) {
    const key = conversationKey(message);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...message,
        count: 1,
        unreadCount: message.isRead ? 0 : 1,
        starred: message.isStarred,
        hasAttachments: message.hasAttachments,
        messageIds: [message.id],
      });
      continue;
    }
    existing.count += 1;
    existing.unreadCount += message.isRead ? 0 : 1;
    existing.starred ||= message.isStarred;
    existing.hasAttachments ||= message.hasAttachments;
    existing.messageIds.push(message.id);
  }
  return [...byKey.values()];
}

/** One conversation per message (grouping turned off). */
export function singleMessages(messages: MessageSummary[]): Conversation[] {
  return messages.map((message) => ({
    ...message,
    count: 1,
    unreadCount: message.isRead ? 0 : 1,
    starred: message.isStarred,
    messageIds: [message.id],
  }));
}
