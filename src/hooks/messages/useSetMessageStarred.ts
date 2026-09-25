import { useMutation } from "@tanstack/react-query";
import { messagesService, syncService } from "@services";
import { useInvalidateMail } from "./useInvalidateMail";

export function useSetMessageStarred() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
      messagesService.setStarred(id, isStarred),
    onSuccess: (accountId) => {
      if (accountId) void syncService.push(accountId);
      return invalidate();
    },
  });
}
