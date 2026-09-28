import { useMutation } from "@tanstack/react-query";

import { messagesService } from "@services";

import { applyToMessages } from "./applyToMessages";
import { useInvalidateMail } from "./useInvalidateMail";

/** Marks one or more messages (e.g. a conversation) read or unread. */
export function useSetMessageRead() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ ids, isRead }: { ids: string[]; isRead: boolean }) =>
      applyToMessages(ids, (id) => messagesService.setRead(id, isRead)),
    onSuccess: invalidate,
  });
}
