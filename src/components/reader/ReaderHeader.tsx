import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccountLabel } from "@components/accounts";
import { SenderAvatar } from "@components/common";
import { formatAddress, formatFullDate } from "@lib";
import type { Account, Message } from "@models";

interface ReaderHeaderProps {
  message: Message;
  /** Set when there are several accounts: shows which one received the message. */
  account?: Account;
}

export function ReaderHeader({ message, account }: ReaderHeaderProps) {
  const { t, i18n } = useTranslation("mail");

  return (
    <header className="space-y-4">
      <h2 data-selectable className="text-xl leading-snug font-semibold">
        {message.subject || t("list.noSubject")}
      </h2>

      <div className="flex items-start gap-3">
        <SenderAvatar name={message.fromName} address={message.fromAddress} className="size-10" />
        <div data-selectable className="min-w-0 flex-1 space-y-0.5 text-[13px]">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-semibold">
              {message.fromName || message.fromAddress}
            </span>
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
          {account && <AccountLabel account={account} className="max-w-48" />}
        </div>
      </div>
    </header>
  );
}
