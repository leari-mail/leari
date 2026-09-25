import { useMutation } from "@tanstack/react-query";

import { type SendRequest, sendService } from "@services";

export function useSendMessage() {
  return useMutation({ mutationFn: (request: SendRequest) => sendService.send(request) });
}
