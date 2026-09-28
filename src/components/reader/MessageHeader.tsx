import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SenderAvatar } from "@components/common";
import { formatAddress, formatFullDate } from "@lib";
import type { Message } from "@models";

interface MessageHeaderProps {
  message: Message;
  /** When set, clicking the header collapses the message (conversation view). */
  onCollapse?: () => void;
}

/** Sender, recipients and date of one message. */
export function MessageHeader({ message, onCollapse }: MessageHeaderProps) {
  const { t, i18n } = useTranslation("mail");

  return (
    <header
      onClick={onCollapse}
      className={`flex items-start gap-3 ${onCollapse ? "cursor-pointer" : ""}`}
    >
      <SenderAvatar name={message.fromName} address={message.fromAddress} className="size-10" />
      <div data-selectable className="min-w-0 flex-1 space-y-0.5 text-[13px]">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{message.fromName || message.fromAddress}</span>
          {message.fromName && (
            <span className="truncate text-xs text-muted-foreground">{message.fromAddress}</span>
          )}
        </div>
        {message.to.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {t("reader.to")}: {message.to.map(formatAddress).join(", ")}
          </p>
        )}
        {message.cc.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {t("reader.cc")}: {message.cc.map(formatAddress).join(", ")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
        <span>{formatFullDate(message.date, i18n.language)}</span>
        {message.hasAttachments && (
          <Paperclip className="size-3" aria-label={t("reader.attachments")} />
        )}
      </div>
    </header>
  );
}
