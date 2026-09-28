import { useTranslation } from "react-i18next";

import { AttachmentList } from "@components/attachments";
import { SenderAvatar } from "@components/common";
import { useMessageAttachments } from "@hooks";
import { cn, formatListDate } from "@lib";
import type { Message } from "@models";

import { MessageBody } from "./MessageBody";
import { MessageHeader } from "./MessageHeader";

interface ConversationMessageProps {
  message: Message;
  expanded: boolean;
  /** Toggles the message; absent when it's the only message (always expanded). */
  onToggle?: () => void;
}

/** One message of a conversation: a single summary line when collapsed, in full when expanded. */
export function ConversationMessage({ message, expanded, onToggle }: ConversationMessageProps) {
  const { t, i18n } = useTranslation(["mail", "common"]);
  const { data: attachments = [] } = useMessageAttachments(expanded ? message.id : undefined);
  // Embedded images (referenced from the HTML body) are not listed as attachments.
  const visibleAttachments = attachments.filter(
    (attachment) => !(attachment.isInline && attachment.contentId),
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/60"
      >
        <SenderAvatar name={message.fromName} address={message.fromAddress} className="size-7" />
        <span
          className={cn("w-40 shrink-0 truncate text-[13px]", !message.isRead && "font-semibold")}
        >
          {message.fromName || message.fromAddress}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {message.snippet}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {formatListDate(message.date, i18n.language, t("common:dates.yesterday"))}
        </span>
      </button>
    );
  }

  return (
    <div className={cn("space-y-4", onToggle && "rounded-lg border bg-card p-4")}>
      <MessageHeader message={message} onCollapse={onToggle} />
      <MessageBody message={message} />
      {visibleAttachments.length > 0 && <AttachmentList attachments={visibleAttachments} />}
    </div>
  );
}
