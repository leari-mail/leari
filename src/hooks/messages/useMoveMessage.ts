import { useMutation } from "@tanstack/react-query";

import { messagesService, type MoveRole } from "@services";
import { useMailStore } from "@stores";

import { applyToMessages } from "./applyToMessages";
import { useInvalidateMail } from "./useInvalidateMail";

export type MoveTarget = MoveRole | { mailboxId: string };

/**
 * Moves messages to a role's mailbox in their own account (archive, trash, spam, inbox) or to a
 * given mailbox. Moving to trash from the trash deletes permanently.
 */
export function useMoveMessage() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ ids, to }: { ids: string[]; to: MoveTarget }) =>
      applyToMessages(ids, (id) =>
        typeof to === "string"
          ? messagesService.moveToRole(id, to)
          : messagesService.moveTo(id, to.mailboxId),
      ),
    onSuccess: (_, { ids }) => {
      const { selectedIds, selectMessage } = useMailStore.getState();
      if (selectedIds.some((id) => ids.includes(id))) selectMessage(null);
      return invalidate();
    },
  });
}
