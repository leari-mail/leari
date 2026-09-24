import { useQuery } from "@tanstack/react-query";
import { accountsService } from "@services";
import { queryKeys } from "../queryKeys";

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: accountsService.list });
}
