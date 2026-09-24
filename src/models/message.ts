import type { messages } from "@db/schema";

export type { MailAddress } from "@db/schema";

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

/** Lightweight row used by message lists (no bodies). */
export type MessageSummary = Omit<Message, "bodyText" | "bodyHtml">;
