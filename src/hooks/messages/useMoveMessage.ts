import { useMutation } from "@tanstack/react-query";
import { messagesService } from "@services";
import { useMailStore } from "@stores";
import { useInvalidateMail } from "./useInvalidateMail";

export function useMoveMessage() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: "trash" | "archive" }) =>
      messagesService.moveToRole(id, to),
    onSuccess: (_, { id }) => {
      const { selectedMessageId, selectMessage } = useMailStore.getState();
      if (selectedMessageId === id) selectMessage(null);
      return invalidate();
    },
  });
}
