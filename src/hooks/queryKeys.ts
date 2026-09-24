import type { FolderSelection } from "@models";

export const queryKeys = {
  bootstrap: ["bootstrap"] as const,
  accounts: ["accounts"] as const,
  mailboxes: ["mailboxes"] as const,
  unreadCounts: ["mailboxes", "unread"] as const,
  messages: ["messages"] as const,
  messageList: (folder: FolderSelection, search: string) =>
    ["messages", "list", folder, search] as const,
  message: (id: string) => ["messages", "detail", id] as const,
};
