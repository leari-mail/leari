import { LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCreateAccount, useErrorMessage, useOAuthProviders, useOAuthSignIn } from "@hooks";
import { providerPresets } from "@lib";
import { isAppError } from "@models";
import type { OAuthProvider } from "@services";
import { Button, DialogFooter } from "@ui";

import { ProviderIcon } from "./ProviderIcon";

interface OAuthSignInProps {
  provider: OAuthProvider;
  onBack: () => void;
  onDone: () => void;
}

/** Google / Microsoft: sign in in the browser, then create the account from the result. */
export function OAuthSignIn({ provider, onBack, onDone }: OAuthSignInProps) {
  const { t } = useTranslation(["accounts", "common"]);
  const errorMessage = useErrorMessage();
  const { data: configured } = useOAuthProviders();
  const signIn = useOAuthSignIn();
  const createAccount = useCreateAccount();
  const providerName = t(`providers.${provider}`);
  const available = configured?.includes(provider) ?? false;
  const preset = providerPresets[provider];

  const start = () =>
    signIn.mutate(provider, {
      onSuccess: (result) =>
        createAccount.mutate(
          {
            oauthHandle: result.handle,
            input: {
              provider,
              name: result.name ?? result.email,
              email: result.email,
              username: result.email,
              authType: "oauth2",
              incomingProtocol: preset.incomingProtocol,
              incomingHost: preset.incoming.host,
              incomingPort: preset.incoming.port,
              incomingSecurity: preset.incoming.security,
              smtpHost: preset.smtp.host,
              smtpPort: preset.smtp.port,
              smtpSecurity: preset.smtp.security,
            },
          },
          { onSuccess: onDone },
        ),
    });

  const waiting = signIn.isPending;
  const error = signIn.error ?? createAccount.error;
  const cancelled = isAppError(error) && error.kind === "cancelled";

  return (
    <div className="space-y-4">
      {available ? (
        <p className="text-sm text-muted-foreground">
          {t("oauth.description", { provider: providerName })}
        </p>
      ) : (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          {t("oauth.notConfigured", { provider: providerName })}
        </p>
      )}

      {available && (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={waiting || createAccount.isPending}
          onClick={start}
        >
          {waiting ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <ProviderIcon provider={provider} className="size-5" />
          )}
          {waiting ? t("oauth.waiting") : t("oauth.signIn", { provider: providerName })}
        </Button>
      )}

      {error && !cancelled && <p className="text-xs text-destructive">{errorMessage(error)}</p>}

      <DialogFooter>
        {waiting ? (
          <Button type="button" variant="ghost" onClick={signIn.cancel}>
            {t("common:actions.cancel")}
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onBack}>
            {t("common:actions.back")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
