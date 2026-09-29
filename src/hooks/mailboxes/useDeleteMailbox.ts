import { useMutation } from "@tanstack/react-query";

import { mailboxesService } from "@services";
import { useMailStore } from "@stores";

import { useInvalidateMailboxes } from "./useInvalidateMailboxes";

/** Deletes a custom folder with its subfolders; leaves it first if it is the open folder. */
export function useDeleteMailbox() {
  const invalidate = useInvalidateMailboxes();
  return useMutation({
    mutationFn: ({ accountId, mailboxId }: { accountId: string; mailboxId: string }) =>
      mailboxesService.remove(accountId, mailboxId),
    onSuccess: () => {
      const { folder, selectFolder } = useMailStore.getState();
      if (folder.kind === "mailbox") selectFolder({ kind: "unified", role: "inbox" });
      return invalidate();
    },
  });
}
