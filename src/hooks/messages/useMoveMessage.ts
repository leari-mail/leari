import { useMutation } from "@tanstack/react-query";

import { messagesService } from "@services";
import { useMailStore } from "@stores";

import { applyToMessages } from "./applyToMessages";
import { useInvalidateMail } from "./useInvalidateMail";

/** Moves messages (e.g. a conversation's messages in the current folder) to trash or archive. */
export function useMoveMessage() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ ids, to }: { ids: string[]; to: "trash" | "archive" }) =>
      applyToMessages(ids, (id) => messagesService.moveToRole(id, to)),
    onSuccess: (_, { ids }) => {
      const { selectedMessageId, selectMessage } = useMailStore.getState();
      if (selectedMessageId && ids.includes(selectedMessageId)) selectMessage(null);
      return invalidate();
    },
  });
}
