import { useAccounts, useConversation } from "@hooks";
import { useMailStore } from "@stores";

import { ConversationView } from "./ConversationView";
import { ReaderEmpty } from "./ReaderEmpty";

/** Right pane: the selected message, or its whole conversation. */
export function MessageReader() {
  const selectedId = useMailStore((state) => state.selectedMessageId);
  const selectedIds = useMailStore((state) => state.selectedIds);
  const { data: messages } = useConversation(selectedId);
  const { data: accounts = [] } = useAccounts();

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
      targetIds={selectedIds.length ? selectedIds : [selectedId]}
      account={account}
      showAccount={accounts.length > 1}
    />
  );
}
