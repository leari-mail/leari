import type { Account, MessageSummary } from "@models";
import { Paperclip, Star } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AccountDot } from "@components/accounts";
import { SenderAvatar } from "@components/common";
import { cn, formatListDate } from "@lib";

interface MessageListItemProps {
  message: MessageSummary;
  account?: Account;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function MessageListItem({ message, account, selected, onSelect }: MessageListItemProps) {
  const { t, i18n } = useTranslation(["mail", "common"]);
  const unread = !message.isRead;

  return (
    <button
      type="button"
      data-message-id={message.id}
      onClick={() => onSelect(message.id)}
      className={cn(
        "relative flex w-full gap-3 rounded-lg py-2.5 pr-3 pl-4 text-left transition-colors outline-none",
        selected
          ? "bg-list-selected text-list-selected-foreground"
          : "hover:bg-accent/70 focus-visible:bg-accent/70",
      )}
    >
      {unread && (
        <span
          aria-hidden
          className={cn(
            "absolute top-[1.35rem] left-1.5 size-2 rounded-full",
            selected ? "bg-list-selected-foreground" : "bg-unread",
          )}
        />
      )}

      <SenderAvatar name={message.fromName} address={message.fromAddress} />

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn("flex-1 truncate text-[13px]", unread ? "font-semibold" : "font-medium")}
          >
            {message.fromName || message.fromAddress}
          </span>
          {message.hasAttachments && <Paperclip className="size-3 shrink-0 opacity-60" />}
          {message.isStarred && (
            <Star
              className={cn("size-3 shrink-0", selected ? "fill-current" : "fill-star text-star")}
            />
          )}
          <span
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              selected ? "text-list-selected-foreground/80" : "text-muted-foreground",
            )}
          >
            {formatListDate(message.date, i18n.language, t("common:dates.yesterday"))}
          </span>
        </div>

        <p className={cn("truncate text-[13px]", unread && "font-medium")}>
          {message.subject || t("mail:list.noSubject")}
        </p>

        <div className="flex items-end gap-2">
          <p
            className={cn(
              "line-clamp-2 flex-1 text-xs leading-snug",
              selected ? "text-list-selected-foreground/75" : "text-muted-foreground",
            )}
          >
            {message.snippet}
          </p>
          {account && <AccountDot color={account.color} className="mb-0.5 size-1.5" />}
        </div>
      </div>
    </button>
  );
}
