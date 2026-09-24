import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountsService, type CreateAccountInput } from "@services";
import { queryKeys } from "../queryKeys";

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => accountsService.create(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes }),
      ]),
  });
}
