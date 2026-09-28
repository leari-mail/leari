import { useQuery } from "@tanstack/react-query";

import { messagesService } from "@services";
import { useSettingsStore } from "@stores";

/** Messages shown in the reader for a selected message: its conversation, oldest first. */
export function useConversation(messageId: string | null) {
  const grouped = useSettingsStore((state) => state.groupByConversation);
  return useQuery({
    queryKey: ["messages", "conversation", messageId, grouped],
    queryFn: async () => {
      if (grouped) return messagesService.conversation(messageId!);
      const message = await messagesService.get(messageId!);
      return message ? [message] : [];
    },
    enabled: !!messageId,
  });
}
