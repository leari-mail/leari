import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import { messagesService } from "@services";
import { useMailStore } from "@stores";

/** Messages of the folder currently selected in the sidebar, filtered by the search box. */
export function useMessages() {
  const folder = useMailStore((state) => state.folder);
  const search = useMailStore((state) => state.searchQuery);

  return useQuery({
    queryKey: queryKeys.messageList(folder, search),
    queryFn: () => messagesService.list(folder, search),
    placeholderData: keepPreviousData,
  });
}
