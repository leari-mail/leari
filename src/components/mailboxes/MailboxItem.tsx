import type { MailboxRole } from "@models";

import { cn } from "@lib/utils";

import { MailboxIcon } from "./MailboxIcon";

interface MailboxItemProps {
  role: MailboxRole;
  label: string;
  count?: number;
  active?: boolean;
  onSelect: () => void;
  className?: string;
}

/** A single sidebar row: icon, label and unread counter. */
export function MailboxItem({
  role,
  label,
  count = 0,
  active,
  onSelect,
  className,
}: MailboxItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/50",
        className,
      )}
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
