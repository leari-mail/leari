import { useMutation } from "@tanstack/react-query";

import { applyToMessages } from "@hooks/messages/applyToMessages";
import { useInvalidateMail } from "@hooks/messages/useInvalidateMail";
import { messagesService } from "@services";
import { useMailStore } from "@stores";

/**
 * Whole-folder changes for one or more mailboxes (several for a unified folder): mark all read,
 * and empty (Trash and Spam permanently, other folders to Trash).
 */
export function useFolderContents() {
  const invalidate = useInvalidateMail();
  const markAllRead = useMutation({
    mutationFn: (mailboxIds: string[]) =>
      applyToMessages(mailboxIds, (id) => messagesService.markAllRead(id)),
    onSuccess: invalidate,
  });
  const empty = useMutation({
    mutationFn: (mailboxIds: string[]) =>
      applyToMessages(mailboxIds, (id) => messagesService.empty(id)),
    onSuccess: () => {
      useMailStore.getState().selectMessage(null);
      return invalidate();
    },
  });
  return { markAllRead, empty };
}
