import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { Account } from "@models";
import { type OAuthProvider, oauthService, syncService } from "@services";

/** Signs an OAuth account in again (e.g. after its access was revoked), then syncs it. */
export function useReauthorizeAccount() {
  const { t, i18n } = useTranslation("accounts");
  return useMutation({
    mutationFn: async (account: Account) => {
      const provider = account.provider as OAuthProvider;
      const result = await oauthService.signIn(provider, i18n.resolvedLanguage ?? "en");
      if (result.email !== account.email.toLowerCase()) {
        throw new Error(t("oauth.wrongAccount", { email: result.email, expected: account.email }));
      }
      await oauthService.attach(account.id, result.handle);
      await syncService.syncNow(account.id);
    },
  });
}
