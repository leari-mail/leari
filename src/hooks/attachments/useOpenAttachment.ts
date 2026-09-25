import { useMutation } from "@tanstack/react-query";

import { attachmentsService } from "@services";

export function useOpenAttachment() {
  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsService.open(attachmentId),
  });
}
