import { useQuery } from "@tanstack/react-query";

import type { Message } from "@models";
import { attachmentsService } from "@services";

/** Embedded images (`cid:` references) of an HTML message, fetched only when it uses them. */
export function useInlineImages(message: Message) {
  const usesInlineImages = message.bodyHtml?.includes("cid:") ?? false;
  return useQuery({
    queryKey: ["attachments", message.id, "inline"],
    queryFn: () => attachmentsService.inlineImages(message.id),
    enabled: usesInlineImages,
    staleTime: Infinity,
    retry: false,
  });
}
