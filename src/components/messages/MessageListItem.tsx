import { Paperclip, Star } from "lucide-react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { AccountEdge } from "@components/accounts";
import { SenderAvatar } from "@components/common";
import { cn, formatListDate } from "@lib";
import type { Account, Conversation } from "@models";

interface MessageListItemProps {
  /** A conversation (or a single message), shown through its newest message. */
  conversation: Conversation;
  /** Set when the list mixes accounts: shown as a colored left edge. */
  account?: Account;
  selected: boolean;
  /** Plain click, ⌘-click or ⇧-click (the list decides from the event's modifiers). */
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
}

export function MessageListItem({
  conversation,
  account,
  selected,
  onSelect,
}: MessageListItemProps) {
  const { t, i18n } = useTranslation(["mail", "common"]);
  const message = conversation;
  const unread = conversation.unreadCount > 0;

  return (
    <button
      type="button"
      data-message-id={message.id}
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "relative isolate flex w-full gap-3 rounded-lg py-2.5 pr-3 pl-4 text-left transition-colors outline-none",
        selected
          ? "bg-list-selected text-list-selected-foreground"
          : "hover:bg-accent/70 focus-visible:bg-accent/70",
      )}
    >
      {account && <AccountEdge color={account.color} label={account.email} />}

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
          {conversation.count > 1 && (
            <span
              aria-label={t("mail:list.conversationCount", { count: conversation.count })}
              className={cn(
                "shrink-0 rounded-full px-1.5 text-[10px] leading-4 font-semibold tabular-nums",
                selected ? "bg-list-selected-foreground/20" : "bg-muted text-muted-foreground",
              )}
            >
              {conversation.count}
            </span>
          )}
          {message.hasAttachments && <Paperclip className="size-3 shrink-0 opacity-60" />}
          {conversation.starred && (
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

        <p
          className={cn(
            "line-clamp-2 text-xs leading-snug",
            selected ? "text-list-selected-foreground/75" : "text-muted-foreground",
          )}
        >
          {message.snippet}
        </p>
      </div>
    </button>
  );
}
