import { accountTint, cn } from "@lib";
import type { Account } from "@models";

interface AccountLabelProps {
  account: Account;
  className?: string;
}

/** The account's email on the same left-to-right color wash as list items (reader header). */
export function AccountLabel({ account, className }: AccountLabelProps) {
  return (
    <span
      className={cn("truncate rounded-md px-2 py-0.5", className)}
      style={{ background: accountTint(account.color, 18) }}
    >
      {account.email}
    </span>
  );
}
