import { describe, expect, it } from "vitest";

import type { MessageSummary } from "@models";

import { conversationKey, groupConversations, singleMessages } from "./conversations";

let next = 0;
function message(overrides: Partial<MessageSummary>): MessageSummary {
  next += 1;
  return {
    id: `m${next}`,
    accountId: "a1",
    mailboxId: "inbox",
    uid: next,
    messageIdHeader: null,
    threadId: null,
    inReplyTo: null,
    subject: "Subject",
    fromName: null,
    fromAddress: "x@example.com",
    to: [],
    cc: [],
    bcc: [],
    replyTo: [],
    snippet: "",
    date: new Date(2026, 8, 28, 12, 0, 0, 0),
    size: null,
    isRead: true,
    isStarred: false,
    isDraft: false,
    hasAttachments: false,
    ...overrides,
  };
}

describe("groupConversations", () => {
  it("groups by thread, represented by the newest message, keeping list order", () => {
    const newest = message({ threadId: "t1", subject: "Re: plan" });
    const other = message({ threadId: "t2" });
    const oldest = message({ threadId: "t1", subject: "plan", isRead: false, isStarred: true });

    const conversations = groupConversations([newest, other, oldest]);

    expect(conversations.map((c) => c.id)).toEqual([newest.id, other.id]);
    expect(conversations[0]).toMatchObject({
      subject: "Re: plan",
      count: 2,
      unreadCount: 1,
      starred: true,
      messageIds: [newest.id, oldest.id],
    });
  });

  it("keeps accounts apart and treats messages without thread as their own", () => {
    const a = message({ threadId: "same" });
    const b = message({ threadId: "same", accountId: "a2" });
    const c = message({});
    const d = message({});

    expect(groupConversations([a, b, c, d])).toHaveLength(4);
    expect(conversationKey(a)).not.toEqual(conversationKey(b));
  });

  it("aggregates attachments across the conversation", () => {
    const [conversation] = groupConversations([
      message({ threadId: "t" }),
      message({ threadId: "t", hasAttachments: true }),
    ]);
    expect(conversation.hasAttachments).toBe(true);
  });
});

describe("singleMessages", () => {
  it("wraps every message as its own conversation", () => {
    const unread = message({ threadId: "t", isRead: false });
    const read = message({ threadId: "t" });
    expect(singleMessages([unread, read]).map((c) => [c.count, c.unreadCount])).toEqual([
      [1, 1],
      [1, 0],
    ]);
  });
});
