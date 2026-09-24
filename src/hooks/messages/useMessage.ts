import { useQuery } from "@tanstack/react-query";
import { messagesService } from "@services";
import { queryKeys } from "../queryKeys";

export function useMessage(id: string | null) {
  return useQuery({
    queryKey: queryKeys.message(id ?? ""),
    queryFn: () => messagesService.get(id!),
    enabled: !!id,
  });
}
