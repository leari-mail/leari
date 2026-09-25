import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@components/common";
import { useErrorMessage, useOpenAttachment, useSaveAttachment } from "@hooks";
import type { Attachment } from "@models";

import { AttachmentChip } from "./AttachmentChip";

interface AttachmentListProps {
  attachments: Attachment[];
}

/** Attachments of the message in the reader: click to open, or save a copy. */
export function AttachmentList({ attachments }: AttachmentListProps) {
  const { t } = useTranslation("mail");
  const open = useOpenAttachment();
  const save = useSaveAttachment();
  const errorMessage = useErrorMessage();
  const error = open.error ?? save.error;

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">
        {t("attachments.count", { count: attachments.length })}
      </h3>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <AttachmentChip
            key={attachment.id}
            name={attachment.filename}
            size={attachment.size}
            mimeType={attachment.mimeType}
            busy={
              (open.isPending && open.variables === attachment.id) ||
              (save.isPending && save.variables === attachment.id)
            }
            onClick={() => open.mutate(attachment.id)}
            actions={
              <IconButton
                label={t("attachments.save")}
                icon={<Download />}
                className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => save.mutate(attachment.id)}
              />
            }
          />
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{errorMessage(error)}</p>}
    </section>
  );
}
