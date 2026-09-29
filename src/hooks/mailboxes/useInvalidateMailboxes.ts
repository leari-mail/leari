import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "@hooks/queryKeys";

/** Refreshes the folder lists and everything about messages (lists, details, counters). */
export function useInvalidateMailboxes() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes }),
        queryClient.invalidateQueries({ queryKey: queryKeys.messages }),
      ]),
    [queryClient],
  );
}
