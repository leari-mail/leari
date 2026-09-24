import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCreateAccount } from "@hooks";
import { providerPresets } from "@lib";
import type { AccountProvider } from "@models";
import { Button, DialogFooter, Input, Label } from "@ui";
import { ServerFields } from "./ServerFields";

interface AccountFormProps {
  provider: AccountProvider;
  onBack: () => void;
  onDone: () => void;
}

export function AccountForm({ provider, onBack, onDone }: AccountFormProps) {
  const { t } = useTranslation(["accounts", "common"]);
  const createAccount = useCreateAccount();
  const preset = providerPresets[provider];
  const isOAuth = preset.authType === "oauth2";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [incoming, setIncoming] = useState(preset.incoming);
  const [smtp, setSmtp] = useState(preset.smtp);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // TODO: run the OAuth flow / store `password` in the OS keychain once the Rust mail engine lands.
    void password;
    createAccount.mutate(
      {
        provider,
        name,
        email,
        username: email,
        authType: preset.authType,
        incomingProtocol: preset.incomingProtocol,
        incomingHost: incoming.host,
        incomingPort: incoming.port,
        incomingSecurity: incoming.security,
        smtpHost: smtp.host,
        smtpPort: smtp.port,
        smtpSecurity: smtp.security,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="account-name">{t("form.name")}</Label>
          <Input
            id="account-name"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="account-email">{t("form.email")}</Label>
          <Input
            id="account-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {!isOAuth && (
          <div className="space-y-1">
            <Label htmlFor="account-password">{t("form.password")}</Label>
            <Input
              id="account-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        )}
      </div>

      {isOAuth ? (
        <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          {t("add.oauthNotice", { provider: t(`providers.${provider}`) })}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <ServerFields title={t("form.incoming")} value={incoming} onChange={setIncoming} />
          <ServerFields title={t("form.outgoing")} value={smtp} onChange={setSmtp} />
        </div>
      )}

      {createAccount.isError && (
        <p className="text-xs text-destructive">{String(createAccount.error)}</p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack}>
          {t("common:actions.back")}
        </Button>
        <Button type="submit" disabled={createAccount.isPending}>
          {t("common:actions.continue")}
        </Button>
      </DialogFooter>
    </form>
  );
}
