import type { ComponentProps } from "react";

import { cn } from "@lib/utils";
import type { MailboxRole } from "@models";

import { MailboxIcon } from "./MailboxIcon";

interface MailboxItemProps extends Omit<ComponentProps<"button">, "onSelect"> {
  role: MailboxRole;
  label: string;
  count?: number;
  active?: boolean;
  /** Subfolder level, for indentation. */
  depth?: number;
  onSelect: () => void;
}

/** A single sidebar row: icon, label and unread counter. */
export function MailboxItem({
  role,
  label,
  count = 0,
  active,
  depth = 0,
  onSelect,
  className,
  style,
  ...props
}: MailboxItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ paddingLeft: depth ? `${0.5 + depth * 0.875}rem` : undefined, ...style }}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50 data-[state=open]:bg-sidebar-accent/50",
        className,
      )}
      {...props}
    >
      <MailboxIcon
        role={role}
        className={cn("size-4 shrink-0", role === "starred" ? "text-star" : "text-sidebar-primary")}
      />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && (
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
      )}
    </button>
  );
}
