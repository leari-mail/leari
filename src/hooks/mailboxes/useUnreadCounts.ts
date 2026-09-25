import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import { mailboxesService } from "@services";

export function useUnreadCounts() {
  return useQuery({
    queryKey: queryKeys.unreadCounts,
    queryFn: () => mailboxesService.unreadCounts(),
  });
}
