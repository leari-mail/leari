import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { type OAuthProvider, oauthService } from "@services";

/** Runs the browser sign-in; `cancel` aborts the one in progress. */
export function useOAuthSignIn() {
  const { i18n } = useTranslation();
  const mutation = useMutation({
    mutationFn: (provider: OAuthProvider) =>
      oauthService.signIn(provider, i18n.resolvedLanguage ?? "en"),
  });
  return { ...mutation, cancel: () => void oauthService.cancel() };
}
