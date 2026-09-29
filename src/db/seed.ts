import { eq } from "drizzle-orm";

import { newId } from "@lib/ids";
import type { MailboxRole, NewMailbox, NewMessage } from "@models";

import { db } from "./client";
import { accounts, attachments, mailboxes, messages } from "./schema";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const standardMailboxes: Array<{ role: MailboxRole; name: string; path: string }> = [
  { role: "inbox", name: "Inbox", path: "INBOX" },
  { role: "sent", name: "Sent", path: "Sent" },
  { role: "drafts", name: "Drafts", path: "Drafts" },
  { role: "archive", name: "Archive", path: "Archive" },
  { role: "spam", name: "Spam", path: "Spam" },
  { role: "trash", name: "Trash", path: "Trash" },
];

interface DemoMessage {
  from: [string, string];
  subject: string;
  body: string;
  ago: number;
  /** Folder role (default inbox). */
  folder?: MailboxRole;
  /** Path of one of the account's custom folders (instead of `folder`). */
  customFolder?: string;
  isRead?: boolean;
  isStarred?: boolean;
  /** Messages with the same thread show as one conversation. */
  thread?: string;
  attachments?: Array<[string, string, number]>;
}

/** Fictional persona and mail, used for development and README screenshots. */
const me = { name: "Maya Oliveira" };

const personal: DemoMessage[] = [
  {
    from: ["Rafael Lima", "rafael@example.com"],
    subject: "Weekend trip to Bahia",
    body: "Hey Maya!\n\nWe're thinking of driving up to the Raso da Catarina on Saturday to see the macaws at sunrise. Want to join? We'd leave at 4 a.m. — I know, I know.\n\nRafa",
    ago: 1 * DAY + 3 * HOUR,
    thread: "trip",
  },
  {
    from: [me.name, "maya@example.com"],
    subject: "Re: Weekend trip to Bahia",
    body: "Count me in! I'll bring coffee (a lot of it) and the binoculars.\n\n> We'd leave at 4 a.m.\n\nOnly for the macaws.",
    ago: 1 * DAY,
    folder: "sent",
    thread: "trip",
  },
  {
    from: ["Rafael Lima", "rafael@example.com"],
    subject: "Re: Weekend trip to Bahia",
    body: "Perfect. Marina is coming too, she has a spot in her car for the three of us.\n\nThe guide says there were more than 200 birds at the canyon last week. Bring a jacket, it's cold before dawn!\n\nSee you Saturday 🦜",
    ago: 25 * MINUTE,
    isRead: false,
    thread: "trip",
  },
  {
    from: ["Instituto Arara-azul", "news@araraazul.example"],
    subject: "Lear's macaw census: the population keeps growing",
    body: "This season's count at the Raso da Catarina shows the Lear's macaw population recovering, thanks to the protection of licuri palms and the work of local communities.\n\nThank you for supporting the project.",
    ago: 3 * HOUR,
    isRead: false,
    isStarred: true,
  },
  {
    from: ["Marina Costa", "marina@example.com"],
    subject: "Photos from the canyon",
    body: "Uploaded my favorites from last month — the sunset ones came out great.",
    ago: 6 * HOUR,
    attachments: [
      ["canyon-sunset.jpg", "image/jpeg", 2_480_000],
      ["macaws-flying.jpg", "image/jpeg", 3_120_000],
    ],
  },
  {
    from: ["Bookshelf Club", "hello@bookshelf.example"],
    subject: "October pick: “The Birds of Brazil”",
    body: "Our next read is a field guide with a twist: stories from the naturalists who first described Brazil's birds. Meetup on the 14th.",
    ago: 2 * DAY,
  },
  {
    from: ["Northwind Travel", "trips@northwind-travel.example"],
    subject: "Your booking is confirmed",
    body: "Salvador → Paulo Afonso, Friday 8:40 AM. Seat 4A. Have a great trip!",
    ago: 3 * DAY,
  },
  {
    from: ["Raso da Catarina Park", "visits@rasodacatarina.example"],
    subject: "Your photography permit",
    body: "Your permit for the canyon viewpoint is approved for Saturday, from 5 a.m. Please keep a distance of at least 50 meters from the roosting cliffs.",
    ago: 6 * DAY,
    customFolder: "Birding/Lear's macaws",
  },
  {
    from: ["Casa das Aves", "orders@casadasaves.example"],
    subject: "Order shipped: 10×42 binoculars",
    body: "Good news: your binoculars are on their way. Estimated delivery on Thursday.",
    ago: 8 * DAY,
    customFolder: "Receipts",
  },
];

const work: DemoMessage[] = [
  {
    from: ["Ana Ribeiro", "ana@northwind.example"],
    subject: "Q4 roadmap review",
    body: "Hi team,\n\nPlease review the Q4 roadmap before Thursday's meeting. I highlighted the items that still need owners.\n\nThanks,\nAna",
    ago: 90 * MINUTE,
    isRead: false,
    isStarred: true,
    attachments: [["roadmap-q4.pdf", "application/pdf", 842_000]],
  },
  {
    from: ["Carlos Mendes", "carlos@northwind.example"],
    subject: "Release checklist",
    body: "Draft of the release checklist is in the shared folder. Can you check the QA section?",
    ago: 1 * DAY + 5 * HOUR,
    thread: "release",
  },
  {
    from: [me.name, "maya@northwind.example"],
    subject: "Re: Release checklist",
    body: "Looks good. I added two items about the migration and the rollback plan.",
    ago: 1 * DAY + 2 * HOUR,
    folder: "sent",
    thread: "release",
  },
  {
    from: ["Carlos Mendes", "carlos@northwind.example"],
    subject: "Re: Release checklist",
    body: "Great additions, merged them. We're good to go on Monday.",
    ago: 4 * HOUR,
    thread: "release",
  },
  {
    from: ["People Team", "people@northwind.example"],
    subject: "Holiday calendar 2027",
    body: "The holiday calendar for next year is now available on the intranet.",
    ago: 4 * DAY,
  },
  {
    from: ["Carlos Mendes", "carlos@northwind.example"],
    subject: "Q4 planning notes",
    body: "Notes from today's planning session are attached. Next check-in is on the 14th.",
    ago: 5 * DAY,
    customFolder: "Projects/Q4 planning",
  },
];

async function seedAccount(options: {
  email: string;
  color: string;
  provider: "google" | "microsoft";
  sortOrder: number;
  mail: DemoMessage[];
  /** Custom folder paths (`/`-delimited), parents first. */
  folders?: string[];
}) {
  const accountId = newId();
  const isGoogle = options.provider === "google";

  await db.insert(accounts).values({
    id: accountId,
    provider: options.provider,
    name: me.name,
    email: options.email,
    color: options.color,
    authType: "oauth2",
    username: options.email,
    incomingProtocol: "imap",
    incomingHost: isGoogle ? "imap.gmail.com" : "outlook.office365.com",
    incomingPort: 993,
    incomingSecurity: "ssl",
    smtpHost: isGoogle ? "smtp.gmail.com" : "smtp.office365.com",
    smtpPort: isGoogle ? 465 : 587,
    smtpSecurity: isGoogle ? "ssl" : "starttls",
    sortOrder: options.sortOrder,
    // Demo accounts have no real server: never try to sync them.
    syncEnabled: false,
    lastSyncedAt: new Date(Date.now() - 3 * MINUTE),
  });

  const boxes: NewMailbox[] = standardMailboxes.map((mailbox, index) => ({
    id: newId(),
    accountId,
    ...mailbox,
    delimiter: "/",
    sortOrder: index,
  }));
  const custom: NewMailbox[] = (options.folders ?? []).map((path, index) => ({
    id: newId(),
    accountId,
    role: "custom",
    path,
    name: path.split("/").pop() ?? path,
    delimiter: "/",
    sortOrder: boxes.length + index,
  }));
  await db.insert(mailboxes).values([...boxes, ...custom]);
  const boxId = (role: MailboxRole) => boxes.find((box) => box.role === role)!.id;
  const folderId = (demo: DemoMessage) =>
    demo.customFolder
      ? custom.find((box) => box.path === demo.customFolder)!.id
      : boxId(demo.folder ?? "inbox");

  const now = Date.now();
  for (const [index, demo] of options.mail.entries()) {
    const id = newId();
    const row: NewMessage = {
      id,
      accountId,
      mailboxId: folderId(demo),
      uid: index + 1,
      messageIdHeader: `${id}@demo.example`,
      threadId: demo.thread ? `${demo.thread}@${options.email}` : null,
      subject: demo.subject,
      fromName: demo.from[0],
      fromAddress: demo.from[1],
      to:
        demo.folder === "sent"
          ? [{ name: "Rafael Lima", address: "rafael@example.com" }]
          : [{ name: me.name, address: options.email }],
      snippet: demo.body.replace(/\s+/g, " ").slice(0, 160),
      bodyText: demo.body,
      date: new Date(now - demo.ago),
      isRead: demo.isRead ?? true,
      isStarred: demo.isStarred ?? false,
      hasAttachments: !!demo.attachments?.length,
    };
    await db.insert(messages).values(row);
    for (const [partIndex, [filename, mimeType, size]] of (demo.attachments ?? []).entries()) {
      await db
        .insert(attachments)
        .values({ id: newId(), messageId: id, filename, mimeType, size, partIndex });
    }
  }

  const inboxId = boxId("inbox");
  const inbox = options.mail.filter(
    (demo) => !demo.customFolder && (demo.folder ?? "inbox") === "inbox",
  );
  await db
    .update(mailboxes)
    .set({
      totalCount: inbox.length,
      unreadCount: inbox.filter((demo) => demo.isRead === false).length,
    })
    .where(eq(mailboxes.id, inboxId));
}

/** Development only: fills an empty database with demo accounts and messages. */
export async function seedDemoData(): Promise<void> {
  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length > 0) return;

  await seedAccount({
    email: "maya@example.com",
    color: "#3552b8",
    provider: "google",
    sortOrder: 0,
    mail: personal,
    folders: ["Birding", "Birding/Lear's macaws", "Receipts"],
  });
  await seedAccount({
    email: "maya@northwind.example",
    color: "#e8b923",
    provider: "microsoft",
    sortOrder: 1,
    mail: work,
    folders: ["Projects", "Projects/Q4 planning"],
  });
}
