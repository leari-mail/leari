import { useMutation } from "@tanstack/react-query";
import { syncService } from "@services";

/** Full sync of one account, or of every account when called without an id. */
export function useSyncNow() {
  return useMutation({ mutationFn: (accountId?: string) => syncService.syncNow(accountId) });
}
