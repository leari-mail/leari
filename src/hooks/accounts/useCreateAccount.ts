import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  accountsService,
  type CreateAccountInput,
  credentialsService,
  syncService,
} from "@services";
import { queryKeys } from "../queryKeys";

interface CreateAccountVariables {
  input: CreateAccountInput;
  /** For password accounts: verified against the server, then stored in the OS keychain. */
  password?: string;
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, password }: CreateAccountVariables) => {
      if (password !== undefined && input.incomingProtocol === "imap") {
        await syncService.testConnection(
          { host: input.incomingHost, port: input.incomingPort, security: input.incomingSecurity },
          input.username,
          password,
        );
      }

      const account = await accountsService.create(input);
      if (password !== undefined) await credentialsService.setPassword(account.id, password);
      return account;
    },
    onSuccess: async (account) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes }),
      ]);
      void syncService.syncNow(account.id);
    },
  });
}
