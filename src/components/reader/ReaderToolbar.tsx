import type { Message } from "@models";
import { Archive, Forward, MailOpen, Reply, ReplyAll, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DragRegion, IconButton } from "@components/common";
import { useMoveMessage, useSetMessageRead, useSetMessageStarred } from "@hooks";
import { cn } from "@lib";
import { useComposerStore } from "@stores";
import { Separator } from "@ui";

interface ReaderToolbarProps {
  message: Message;
}

function quote(message: Message) {
  const body = (message.bodyText ?? message.snippet)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${message.fromName ?? message.fromAddress}:\n${body}`;
}

export function ReaderToolbar({ message }: ReaderToolbarProps) {
  const { t } = useTranslation("mail");
  const openComposer = useComposerStore((state) => state.open);
  const setRead = useSetMessageRead();
  const setStarred = useSetMessageStarred();
  const move = useMoveMessage();

  const replySubject = message.subject.match(/^re:/i) ? message.subject : `Re: ${message.subject}`;

  return (
    <DragRegion className="gap-0.5 border-b border-border/70 px-3">
      <IconButton
        label={t("reader.reply")}
        icon={<Reply />}
        onClick={() =>
          openComposer({
            accountId: message.accountId,
            to: message.fromAddress,
            subject: replySubject,
            body: quote(message),
          })
        }
      />
      <IconButton
        label={t("reader.replyAll")}
        icon={<ReplyAll />}
        onClick={() =>
          openComposer({
            accountId: message.accountId,
            to: [message.fromAddress, ...message.to.map((to) => to.address)].join(", "),
            cc: message.cc.map((cc) => cc.address).join(", "),
            subject: replySubject,
            body: quote(message),
          })
        }
      />
      <IconButton
        label={t("reader.forward")}
        icon={<Forward />}
        onClick={() =>
          openComposer({
            accountId: message.accountId,
            subject: `Fwd: ${message.subject}`,
            body: quote(message),
          })
        }
      />

      <Separator orientation="vertical" className="mx-1.5 h-4!" />

      <IconButton
        label={t("reader.archive")}
        icon={<Archive />}
        onClick={() => move.mutate({ id: message.id, to: "archive" })}
      />
      <IconButton
        label={t("reader.delete")}
        icon={<Trash2 />}
        onClick={() => move.mutate({ id: message.id, to: "trash" })}
      />

      <div data-tauri-drag-region className="h-full flex-1" />

      <IconButton
        label={message.isRead ? t("reader.markUnread") : t("reader.markRead")}
        icon={<MailOpen />}
        onClick={() => setRead.mutate({ id: message.id, isRead: !message.isRead })}
      />
      <IconButton
        label={message.isStarred ? t("reader.unstar") : t("reader.star")}
        icon={<Star className={cn(message.isStarred && "fill-star text-star")} />}
        onClick={() => setStarred.mutate({ id: message.id, isStarred: !message.isStarred })}
      />
    </DragRegion>
  );
}
