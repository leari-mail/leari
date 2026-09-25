import { useMutation } from "@tanstack/react-query";

import { messagesService, syncService } from "@services";

import { useInvalidateMail } from "./useInvalidateMail";

export function useSetMessageRead() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      messagesService.setRead(id, isRead),
    onSuccess: (accountId) => {
      if (accountId) void syncService.push(accountId);
      return invalidate();
    },
  });
}
