import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsService } from "@services";
import { useMailStore } from "@stores";

export function useRemoveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accountsService.remove(id),
    onSuccess: (_, id) => {
      const { folder, selectFolder } = useMailStore.getState();
      if (folder.kind === "mailbox" && folder.accountId === id) {
        selectFolder({ kind: "unified", role: "inbox" });
      }
      return queryClient.invalidateQueries();
    },
  });
}
