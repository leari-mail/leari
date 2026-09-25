import type { ReactNode } from "react";

import { cn } from "@lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col items-center justify-center gap-3 p-8 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/60 [&_svg]:size-10">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-64 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
