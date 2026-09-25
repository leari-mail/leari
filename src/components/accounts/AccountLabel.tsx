import { cn } from "@lib";
import type { Account } from "@models";

interface AccountLabelProps {
  account: Account;
  className?: string;
}

/** The account's email with a short fading bar in its color (reader header). */
export function AccountLabel({ account, className }: AccountLabelProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span
        aria-hidden
        className="h-3 w-[3px] shrink-0 rounded-full"
        style={{
          background: `linear-gradient(to bottom, transparent, ${account.color} 25%, ${account.color} 75%, transparent)`,
        }}
      />
      <span className="truncate">{account.email}</span>
    </span>
  );
}
