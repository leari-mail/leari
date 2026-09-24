import { useMutation } from "@tanstack/react-query";
import { messagesService } from "@services";
import { useInvalidateMail } from "./useInvalidateMail";

export function useSetMessageStarred() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ id, isStarred }: { id: string; isStarred: boolean }) =>
      messagesService.setStarred(id, isStarred),
    onSuccess: invalidate,
  });
}
