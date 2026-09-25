import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import { accountsService } from "@services";

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: () => accountsService.list() });
}
