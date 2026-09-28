import { useMutation } from "@tanstack/react-query";

import { messagesService } from "@services";

import { applyToMessages } from "./applyToMessages";
import { useInvalidateMail } from "./useInvalidateMail";

export function useSetMessageStarred() {
  const invalidate = useInvalidateMail();
  return useMutation({
    mutationFn: ({ ids, isStarred }: { ids: string[]; isStarred: boolean }) =>
      applyToMessages(ids, (id) => messagesService.setStarred(id, isStarred)),
    onSuccess: invalidate,
  });
}
