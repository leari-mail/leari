import type { attachments } from "@db/schema";

export type Attachment = typeof attachments.$inferSelect;

/** A file on disk (picked or dropped in the composer). */
export interface LocalFile {
  path: string;
  name: string;
  size: number;
}

/** What the composer sends: a local file, or an attachment of a received message (forwarding). */
export type ComposerAttachment =
  | ({ kind: "file" } & LocalFile)
  | { kind: "forwarded"; attachmentId: string; name: string; size: number };
