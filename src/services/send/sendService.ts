import { invoke } from "@tauri-apps/api/core";

export interface SendRequest {
  accountId: string;
  /** Recipient fields as typed: comma- or semicolon-separated addresses. */
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  /** Plain-text body (text/plain part). */
  body: string;
  /** HTML body (text/html alternative), when written in the rich text editor. */
  html?: string;
  replyToMessageId?: string;
  attachments: Array<{ kind: "file"; path: string } | { kind: "forwarded"; attachmentId: string }>;
}

/** Sends through the account's SMTP server (Rust, src-tauri/src/mail/send.rs). */
export const sendService = {
  send: (request: SendRequest) => invoke<void>("mail_send", { request }),
};
