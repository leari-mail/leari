import { invoke } from "@tauri-apps/api/core";
import { asc, eq } from "drizzle-orm";

import { attachments, db } from "@db";
import type { Attachment, LocalFile } from "@models";

/** Attachment metadata comes from SQLite; contents are fetched on demand by Rust. */
export const attachmentsService = {
  listByMessage(messageId: string): Promise<Attachment[]> {
    return db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, messageId))
      .orderBy(asc(attachments.partIndex));
  },

  /** Downloads (if needed) and opens with the default app. */
  open: (attachmentId: string) => invoke<void>("attachment_open", { attachmentId }),

  /** Asks where to save; resolves to the saved path, or null when cancelled. */
  save: (attachmentId: string) => invoke<string | null>("attachment_save", { attachmentId }),

  /** `cid` → `data:` URL for images embedded in a message's HTML. */
  inlineImages: (messageId: string) =>
    invoke<Record<string, string>>("message_inline_images", { messageId }),

  /** Native file picker. */
  pick: () => invoke<LocalFile[]>("attachments_pick"),

  /** Name and size of dropped files. */
  stat: (paths: string[]) => invoke<LocalFile[]>("attachments_stat", { paths }),
};
