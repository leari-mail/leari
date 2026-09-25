import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { cn, formatBytes } from "@lib";

import { FileIcon } from "./FileIcon";

interface AttachmentChipProps {
  name: string;
  size: number;
  mimeType?: string;
  /** Clicking the chip (e.g. open). */
  onClick?: () => void;
  busy?: boolean;
  /** Trailing actions (save, remove…). */
  actions?: ReactNode;
  className?: string;
}

export function AttachmentChip({
  name,
  size,
  mimeType,
  onClick,
  busy,
  actions,
  className,
}: AttachmentChipProps) {
  const { i18n } = useTranslation();

  return (
    <div
      className={cn(
        "group flex h-11 max-w-64 min-w-0 items-center gap-2 rounded-lg border bg-card pr-1 pl-2.5 text-left",
        busy && "animate-pulse",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick || busy}
        className="flex min-w-0 flex-1 items-center gap-2 outline-none disabled:cursor-default"
      >
        <FileIcon name={name} mimeType={mimeType} className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{name}</span>
          <span className="block text-[11px] text-muted-foreground">
            {formatBytes(size, i18n.language)}
          </span>
        </span>
      </button>
      {actions}
    </div>
  );
}
