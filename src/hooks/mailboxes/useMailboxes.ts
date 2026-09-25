import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import { mailboxesService } from "@services";

export function useMailboxes() {
  return useQuery({ queryKey: queryKeys.mailboxes, queryFn: () => mailboxesService.list() });
}
