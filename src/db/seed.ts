import { eq } from "drizzle-orm";
import type { MailboxRole, NewMailbox, NewMessage } from "@models";
import { newId } from "@lib/ids";
import { db } from "./client";
import { accounts, mailboxes, messages } from "./schema";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const standardMailboxes: Array<{ role: MailboxRole; name: string; path: string }> = [
  { role: "inbox", name: "Inbox", path: "INBOX" },
  { role: "starred", name: "Starred", path: "Starred" },
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
  isRead?: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
}

const personalInbox: DemoMessage[] = [
  {
    from: ["Instituto Arara-azul", "news@araraazul.org"],
    subject: "Lear's macaw census: population keeps growing",
    body: "Great news from the Raso da Catarina! This season's count shows the Lear's macaw population continuing to recover thanks to licuri palm protection.\n\nThank you for supporting the project.",
    ago: 0.4 * HOUR,
  },
  {
    from: ["Marina Costa", "marina@example.com"],
    subject: "Trip photos 📸",
    body: "Hey! I finally uploaded the photos from Bahia. The ones at sunset near the cliffs are my favorites.\n\nLet me know which ones you want printed.",
    ago: 3 * HOUR,
    hasAttachments: true,
  },
  {
    from: ["GitHub", "noreply@github.com"],
    subject: "[leari-mail/leari] New star on your repository",
    body: "Someone starred leari-mail/leari. Keep building!",
    ago: 20 * HOUR,
    isRead: true,
  },
  {
    from: ["Rafael Lima", "rafa@example.com"],
    subject: "Churrasco no sábado?",
    body: "Fala! Vamos marcar aquele churrasco no sábado? Eu levo a picanha, você leva a farofa.\n\nAbraço",
    ago: 1.2 * DAY,
    isStarred: true,
  },
  {
    from: ["Nubank", "no-reply@nubank.com.br"],
    subject: "Sua fatura fechou",
    body: "Olá! A fatura do seu cartão fechou. Confira os detalhes no app.",
    ago: 3 * DAY,
    isRead: true,
  },
  {
    from: ["Tauri", "newsletter@tauri.app"],
    subject: "What's new in Tauri 2",
    body: "Mobile support, a new plugin system, capabilities and much more. Read the full release notes on our blog.",
    ago: 9 * DAY,
    isRead: true,
  },
];

const workInbox: DemoMessage[] = [
  {
    from: ["Ana Ribeiro", "ana.ribeiro@contoso.com"],
    subject: "Q4 roadmap review",
    body: "Hi team,\n\nPlease review the Q4 roadmap draft before Thursday's meeting. I've highlighted the items that still need owners.\n\nThanks,\nAna",
    ago: 1.5 * HOUR,
    isStarred: true,
    hasAttachments: true,
  },
  {
    from: ["Microsoft Teams", "noreply@teams.microsoft.com"],
    subject: "You have 3 unread messages in #design",
    body: "Catch up on the conversation in #design.",
    ago: 5 * HOUR,
  },
  {
    from: ["Carlos Mendes", "carlos.mendes@contoso.com"],
    subject: "Re: Onboarding checklist",
    body: "Looks good to me. I added two items about VPN access and the security training.",
    ago: 2 * DAY,
    isRead: true,
  },
  {
    from: ["HR", "hr@contoso.com"],
    subject: "Holiday calendar 2027",
    body: "The holiday calendar for next year is now available on the intranet.",
    ago: 6 * DAY,
    isRead: true,
  },
];

async function seedAccount(options: {
  name: string;
  email: string;
  color: string;
  provider: "google" | "microsoft";
  sortOrder: number;
  inbox: DemoMessage[];
}) {
  const accountId = newId();
  const isGoogle = options.provider === "google";

  await db.insert(accounts).values({
    id: accountId,
    provider: options.provider,
    name: options.name,
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
  });

  const boxes: NewMailbox[] = standardMailboxes.map((mailbox, index) => ({
    id: newId(),
    accountId,
    ...mailbox,
    sortOrder: index,
  }));
  await db.insert(mailboxes).values(boxes);

  const inbox = boxes[0];
  const now = Date.now();
  const rows: NewMessage[] = options.inbox.map((demo, index) => ({
    id: newId(),
    accountId,
    mailboxId: inbox.id!,
    uid: index + 1,
    subject: demo.subject,
    fromName: demo.from[0],
    fromAddress: demo.from[1],
    to: [{ name: options.name, address: options.email }],
    snippet: demo.body.replace(/\s+/g, " ").slice(0, 140),
    bodyText: demo.body,
    date: new Date(now - demo.ago),
    isRead: demo.isRead ?? false,
    isStarred: demo.isStarred ?? false,
    hasAttachments: demo.hasAttachments ?? false,
  }));
  await db.insert(messages).values(rows);

  const unread = rows.filter((row) => !row.isRead).length;
  await db
    .update(mailboxes)
    .set({ unreadCount: unread, totalCount: rows.length })
    .where(eq(mailboxes.id, inbox.id!));
}

/** Development only: fills an empty database with demo accounts and messages. */
export async function seedDemoData(): Promise<void> {
  const existing = await db.select({ id: accounts.id }).from(accounts).limit(1);
  if (existing.length > 0) return;

  await seedAccount({
    name: "Pablo Souza",
    email: "pablo@gmail.com",
    color: "#3552b8",
    provider: "google",
    sortOrder: 0,
    inbox: personalInbox,
  });
  await seedAccount({
    name: "Pablo Souza",
    email: "pablo.souza@contoso.com",
    color: "#e8b923",
    provider: "microsoft",
    sortOrder: 1,
    inbox: workInbox,
  });
}
