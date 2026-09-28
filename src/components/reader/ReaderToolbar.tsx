import { Archive, Forward, MailOpen, Reply, ReplyAll, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DragRegion, IconButton } from "@components/common";
import {
  useMessageAttachments,
  useMoveMessage,
  useSetMessageRead,
  useSetMessageStarred,
} from "@hooks";
import { cn } from "@lib";
import type { Message } from "@models";
import { useComposerStore } from "@stores";
import { Separator } from "@ui";

interface ReaderToolbarProps {
  /** The conversation shown in the reader, oldest first. */
  messages: Message[];
  /** Message that reply / forward respond to (newest one from someone else). */
  replyTo: Message;
  /** Messages archive / delete act on: the selected row's messages in the current folder. */
  targetIds: string[];
}

function quote(message: Message) {
  const body = (message.bodyText ?? message.snippet)
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${message.fromName ?? message.fromAddress}:\n${body}`;
}

export function ReaderToolbar({ messages, replyTo, targetIds }: ReaderToolbarProps) {
  const { t } = useTranslation("mail");
  const openComposer = useComposerStore((state) => state.open);
  const setRead = useSetMessageRead();
  const setStarred = useSetMessageStarred();
  const move = useMoveMessage();
  const { data: attachments = [] } = useMessageAttachments(replyTo.id);

  const replySubject = replyTo.subject.match(/^re:/i) ? replyTo.subject : `Re: ${replyTo.subject}`;
  const unreadIds = messages.filter((message) => !message.isRead).map((message) => message.id);
  const starredIds = messages.filter((message) => message.isStarred).map((message) => message.id);

  return (
    <DragRegion className="gap-0.5 border-b border-border/70 px-3">
      <IconButton
        label={t("reader.reply")}
        icon={<Reply />}
        onClick={() =>
          openComposer({
            accountId: replyTo.accountId,
            to: replyTo.fromAddress,
            subject: replySubject,
            body: quote(replyTo),
            replyToMessageId: replyTo.id,
          })
        }
      />
      <IconButton
        label={t("reader.replyAll")}
        icon={<ReplyAll />}
        onClick={() =>
          openComposer({
            accountId: replyTo.accountId,
            to: [replyTo.fromAddress, ...replyTo.to.map((to) => to.address)].join(", "),
            cc: replyTo.cc.map((cc) => cc.address).join(", "),
            subject: replySubject,
            body: quote(replyTo),
            replyToMessageId: replyTo.id,
          })
        }
      />
      <IconButton
        label={t("reader.forward")}
        icon={<Forward />}
        onClick={() =>
          openComposer({
            accountId: replyTo.accountId,
            subject: `Fwd: ${replyTo.subject}`,
            body: quote(replyTo),
            attachments: attachments
              .filter((attachment) => !(attachment.isInline && attachment.contentId))
              .map((attachment) => ({
                kind: "forwarded" as const,
                attachmentId: attachment.id,
                name: attachment.filename,
                size: attachment.size,
              })),
          })
        }
      />

      <Separator orientation="vertical" className="mx-1.5 h-4!" />

      <IconButton
        label={t("reader.archive")}
        icon={<Archive />}
        onClick={() => move.mutate({ ids: targetIds, to: "archive" })}
      />
      <IconButton
        label={t("reader.delete")}
        icon={<Trash2 />}
        onClick={() => move.mutate({ ids: targetIds, to: "trash" })}
      />

      <div data-tauri-drag-region className="h-full flex-1" />

      <IconButton
        label={unreadIds.length ? t("reader.markRead") : t("reader.markUnread")}
        icon={<MailOpen />}
        onClick={() =>
          unreadIds.length
            ? setRead.mutate({ ids: unreadIds, isRead: true })
            : setRead.mutate({ ids: [replyTo.id], isRead: false })
        }
      />
      <IconButton
        label={starredIds.length ? t("reader.unstar") : t("reader.star")}
        icon={<Star className={cn(starredIds.length > 0 && "fill-star text-star")} />}
        onClick={() =>
          starredIds.length
            ? setStarred.mutate({ ids: starredIds, isStarred: false })
            : setStarred.mutate({ ids: [replyTo.id], isStarred: true })
        }
      />
    </DragRegion>
  );
}
