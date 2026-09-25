import { useQuery } from "@tanstack/react-query";

import { attachmentsService } from "@services";

export function useMessageAttachments(messageId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", messageId],
    queryFn: () => attachmentsService.listByMessage(messageId!),
    enabled: !!messageId,
  });
}
