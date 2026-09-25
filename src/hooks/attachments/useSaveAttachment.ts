import { useMutation } from "@tanstack/react-query";

import { attachmentsService } from "@services";

export function useSaveAttachment() {
  return useMutation({
    mutationFn: (attachmentId: string) => attachmentsService.save(attachmentId),
  });
}
