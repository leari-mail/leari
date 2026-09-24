import { useMutation } from "@tanstack/react-query";
import { messagesService } from "@services";
import { useInvalidateMail } from "./useInvalidateMail";

export function useSetMessageRead() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ id, isRead }: { id: string; isRead: boolean }) =>
      messagesService.setRead(id, isRead),
    onSuccess: invalidate,
  });
}
