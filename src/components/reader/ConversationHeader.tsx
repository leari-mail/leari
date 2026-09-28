import { useTranslation } from "react-i18next";

import { AccountLabel } from "@components/accounts";
import type { Account } from "@models";

interface ConversationHeaderProps {
  subject: string;
  count: number;
  /** Set when there are several accounts: shows which one the conversation belongs to. */
  account?: Account;
}

export function ConversationHeader({ subject, count, account }: ConversationHeaderProps) {
  const { t } = useTranslation("mail");

  return (
    <header className="space-y-1.5">
      <h2 data-selectable className="text-xl leading-snug font-semibold">
        {subject || t("list.noSubject")}
      </h2>
      {(count > 1 || account) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {count > 1 && <span>{t("reader.messageCount", { count })}</span>}
          {account && <AccountLabel account={account} className="max-w-60" />}
        </div>
      )}
    </header>
  );
}
