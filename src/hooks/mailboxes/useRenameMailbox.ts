import { useMutation } from "@tanstack/react-query";

import { mailboxesService } from "@services";

import { useInvalidateMailboxes } from "./useInvalidateMailboxes";

export function useRenameMailbox() {
  const invalidate = useInvalidateMailboxes();
  return useMutation({
    mutationFn: ({
      accountId,
      mailboxId,
      name,
    }: {
      accountId: string;
      mailboxId: string;
      name: string;
    }) => mailboxesService.rename(accountId, mailboxId, name),
    onSuccess: invalidate,
  });
}
