import { useQuery } from "@tanstack/react-query";
import { mailboxesService } from "@services";
import { queryKeys } from "../queryKeys";

export function useMailboxes() {
  return useQuery({ queryKey: queryKeys.mailboxes, queryFn: mailboxesService.list });
}
