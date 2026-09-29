import { useMutation } from "@tanstack/react-query";

import { mailboxesService } from "@services";

import { useInvalidateMailboxes } from "./useInvalidateMailboxes";

/** Creates a folder at an account's top level, or inside `parentId`. */
export function useCreateMailbox() {
  const invalidate = useInvalidateMailboxes();
  return useMutation({
    mutationFn: ({
      accountId,
      parentId,
      name,
    }: {
      accountId: string;
      parentId: string | null;
      name: string;
    }) => mailboxesService.create(accountId, parentId, name),
    onSuccess: invalidate,
  });
}
