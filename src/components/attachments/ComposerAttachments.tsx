import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@components/common";
import type { ComposerAttachment } from "@models";

import { AttachmentChip } from "./AttachmentChip";

interface ComposerAttachmentsProps {
  attachments: ComposerAttachment[];
  onRemove: (attachment: ComposerAttachment) => void;
}

export function ComposerAttachments({ attachments, onRemove }: ComposerAttachmentsProps) {
  const { t } = useTranslation("mail");
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-2.5">
      {attachments.map((attachment) => (
        <AttachmentChip
          key={attachment.kind === "file" ? attachment.path : attachment.attachmentId}
          name={attachment.name}
          size={attachment.size}
          actions={
            <IconButton
              label={t("attachments.remove", { name: attachment.name })}
              icon={<X />}
              className="size-7"
              onClick={() => onRemove(attachment)}
            />
          }
        />
      ))}
    </div>
  );
}
