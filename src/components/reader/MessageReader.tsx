import { useAccounts, useConversation } from "@hooks";
import { useMailStore } from "@stores";

import { ConversationView } from "./ConversationView";
import { ReaderEmpty } from "./ReaderEmpty";
import { SelectionSummary } from "./SelectionSummary";

/** Right pane: the selected message, or its whole conversation. */
export function MessageReader() {
  const selectedId = useMailStore((state) => state.selectedMessageId);
  const multiple = useMailStore((state) => state.selectedRows.length > 1);
  const { data: messages } = useConversation(multiple ? null : selectedId);
  const { data: accounts = [] } = useAccounts();

  if (multiple) return <SelectionSummary />;

  if (!selectedId || !messages?.length) {
    return (
      <section className="h-full bg-background">
        <ReaderEmpty />
      </section>
    );
  }

  const account = accounts.find((item) => item.id === messages[0].accountId);
  return (
    <ConversationView
      key={selectedId}
      messages={messages}
      account={account}
      showAccount={accounts.length > 1}
    />
  );
}
