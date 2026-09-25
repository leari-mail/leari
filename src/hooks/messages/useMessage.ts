import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import { messagesService } from "@services";

export function useMessage(id: string | null) {
  return useQuery({
    queryKey: queryKeys.message(id ?? ""),
    queryFn: () => messagesService.get(id!),
    enabled: !!id,
  });
}
