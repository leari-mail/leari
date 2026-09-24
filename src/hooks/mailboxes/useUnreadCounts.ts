import { useQuery } from "@tanstack/react-query";
import { mailboxesService } from "@services";
import { queryKeys } from "../queryKeys";

export function useUnreadCounts() {
  return useQuery({ queryKey: queryKeys.unreadCounts, queryFn: mailboxesService.unreadCounts });
}
