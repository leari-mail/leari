import { useEffect } from "react";

import { useAccounts, useMessage, useSetMessageRead } from "@hooks";
import { useMailStore, useSettingsStore } from "@stores";
import { ScrollArea } from "@ui";

import { MessageBody } from "./MessageBody";
import { ReaderEmpty } from "./ReaderEmpty";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderToolbar } from "./ReaderToolbar";

/** Right pane: the selected message. */
export function MessageReader() {
  const selectedId = useMailStore((state) => state.selectedMessageId);
  const markAsReadOnOpen = useSettingsStore((state) => state.markAsReadOnOpen);
  const { data: message } = useMessage(selectedId);
  const { data: accounts = [] } = useAccounts();
  const { mutate: setRead } = useSetMessageRead();

  const messageId = message?.id;
  const isRead = message?.isRead;
  useEffect(() => {
    if (markAsReadOnOpen && messageId && isRead === false) setRead({ id: messageId, isRead: true });
    // Only when a different message is opened, so "mark as unread" sticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  if (!message) {
    return (
      <section className="h-full bg-background">
        <ReaderEmpty />
      </section>
    );
  }

  const account = accounts.find((item) => item.id === message.accountId);

  return (
    <section className="flex h-full flex-col bg-background">
      <ReaderToolbar message={message} />
      <ScrollArea className="min-h-0 flex-1">
        <article className="mx-auto max-w-3xl space-y-6 px-8 py-6">
          <ReaderHeader message={message} account={account} />
          <MessageBody message={message} />
        </article>
      </ScrollArea>
    </section>
  );
}
