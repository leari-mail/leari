import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@hooks/queryKeys";
import {
  accountsService,
  type CreateAccountInput,
  credentialsService,
  oauthService,
  syncService,
} from "@services";

interface CreateAccountVariables {
  input: CreateAccountInput;
  /** For password accounts: verified against the server, then stored in the OS keychain. */
  password?: string;
  /** For OAuth accounts: the completed sign-in whose tokens belong to this account. */
  oauthHandle?: string;
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ input, password, oauthHandle }: CreateAccountVariables) => {
      if (password !== undefined && input.incomingProtocol === "imap") {
        await syncService.testConnection(
          { host: input.incomingHost, port: input.incomingPort, security: input.incomingSecurity },
          input.username,
          password,
        );
      }

      const account = await accountsService.create(input);
      if (password !== undefined) await credentialsService.setPassword(account.id, password);
      if (oauthHandle) await oauthService.attach(account.id, oauthHandle);
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
