import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { queryKeys } from "@hooks/queryKeys";
import { syncService } from "@services";
import { useSyncStore } from "@stores";

/**
 * Starts background sync and keeps the UI in step with it: statuses go to the sync store,
 * data changes refresh the affected queries.
 */
export function useSyncEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { setStatus, setStatuses } = useSyncStore.getState();

    const onChanged = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messages }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes }),
      ]);

    const subscriptions = [
      syncService.onStatus(setStatus),
      syncService.onChanged(() => void onChanged()),
    ];
    void syncService.statuses().then(setStatuses);
    void syncService.start();

    return () => {
      for (const subscription of subscriptions) void subscription.then((stop) => stop());
    };
  }, [queryClient]);
}
