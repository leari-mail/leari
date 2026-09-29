import { describe, expect, it } from "vitest";

import type { FolderSelection, MailboxRole } from "@models";

import { canDrop, dropTargetKey, parseDropTarget } from "./drop-targets";

const box = (id: string, accountId: string, role: MailboxRole) => ({ id, accountId, role });
const mailboxes = [
  box("a-inbox", "a", "inbox"),
  box("a-drafts", "a", "drafts"),
  box("a-trash", "a", "trash"),
  box("a-work", "a", "custom"),
  box("b-inbox", "b", "inbox"),
  box("b-work", "b", "custom"),
];
const inA: FolderSelection = { kind: "mailbox", mailboxId: "a-inbox", accountId: "a" };
const allInboxes: FolderSelection = { kind: "unified", role: "inbox" };

describe("drop targets", () => {
  it("round-trips keys", () => {
    expect(parseDropTarget(dropTargetKey({ kind: "mailbox", mailboxId: "x:y" }))).toEqual({
      kind: "mailbox",
      mailboxId: "x:y",
    });
    expect(parseDropTarget("role:trash")).toEqual({ kind: "role", role: "trash" });
    expect(parseDropTarget("nope")).toBeNull();
    expect(parseDropTarget(undefined)).toBeNull();
  });

  it("allows the account's other folders only", () => {
    const to = (mailboxId: string) => ({ kind: "mailbox" as const, mailboxId });
    expect(canDrop(to("a-work"), ["a"], inA, mailboxes)).toBe(true);
    expect(canDrop(to("a-trash"), ["a"], inA, mailboxes)).toBe(true);
    expect(canDrop(to("a-inbox"), ["a"], inA, mailboxes)).toBe(false); // already there
    expect(canDrop(to("a-drafts"), ["a"], inA, mailboxes)).toBe(false);
    expect(canDrop(to("b-work"), ["a"], inA, mailboxes)).toBe(false); // another account
    expect(canDrop(to("a-work"), ["a", "b"], allInboxes, mailboxes)).toBe(false);
    expect(canDrop(to("a-inbox"), ["a"], allInboxes, mailboxes)).toBe(false);
    expect(canDrop(to("a-work"), [], inA, mailboxes)).toBe(false);
  });

  it("resolves unified folders per account and stars on Starred", () => {
    const to = (role: MailboxRole) => ({ kind: "role" as const, role });
    expect(canDrop(to("trash"), ["a", "b"], allInboxes, mailboxes)).toBe(true);
    expect(canDrop(to("inbox"), ["a", "b"], allInboxes, mailboxes)).toBe(false);
    expect(canDrop(to("inbox"), ["a"], inA, mailboxes)).toBe(false);
    expect(canDrop(to("starred"), ["a"], inA, mailboxes)).toBe(true);
    expect(canDrop(to("sent"), ["a"], inA, mailboxes)).toBe(false);
  });
});
