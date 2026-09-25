import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { queryKeys } from "@hooks/queryKeys";

/** Refreshes message lists, message details and unread counters. */
export function useInvalidateMail() {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messages }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts }),
      ]),
    [queryClient],
  );
}
