import type { messages } from "@db/schema";

export type { MailAddress } from "@db/schema";

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

/** Lightweight row used by message lists (no bodies). */
export type MessageSummary = Omit<Message, "bodyText" | "bodyHtml">;

/** A conversation in the message list, represented by its newest message. */
export type Conversation = MessageSummary & {
  count: number;
  unreadCount: number;
  starred: boolean;
  /** Ids of the conversation's messages in the listed folder, newest first. */
  messageIds: string[];
};
