import { describe, expect, it } from "vitest";

import type { MailboxRole } from "@models";

import { nestMailboxes } from "./folders";

let order = 0;
const folder = (path: string, role: MailboxRole = "custom", delimiter: string | null = "/") => ({
  id: path,
  path,
  name: path.split(delimiter ?? "\u0000").pop() ?? path,
  role,
  delimiter,
  sortOrder: order++,
});

describe("nestMailboxes", () => {
  it("puts special folders first and subfolders right after their parent", () => {
    const nested = nestMailboxes([
      folder("Work/Clients"),
      folder("INBOX", "inbox"),
      folder("Receipts"),
      folder("Work"),
      folder("Trash", "trash"),
      folder("Work/Clients/Acme"),
      folder("Archive/2025"),
    ]);
    expect(nested.map(({ mailbox, depth }) => `${depth}:${mailbox.path}`)).toEqual([
      "0:INBOX",
      "0:Trash",
      "0:Archive/2025",
      "0:Receipts",
      "0:Work",
      "1:Work/Clients",
      "2:Work/Clients/Acme",
    ]);
  });

  it("does not indent folders under special folders or without a delimiter", () => {
    const nested = nestMailboxes([
      folder("INBOX", "inbox", "."),
      folder("INBOX.Work", "custom", "."),
      folder("Plain", "custom", null),
    ]);
    expect(nested.map(({ mailbox, depth }) => `${depth}:${mailbox.path}`)).toEqual([
      "0:INBOX",
      "0:Plain",
      "0:INBOX.Work", // shown as "Work": siblings sort by name
    ]);
  });
});
