import type { AccountProvider } from "@models";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useDialogStore } from "@stores";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@ui";

import { AccountForm } from "./AccountForm";
import { ProviderPicker } from "./ProviderPicker";

/** Two steps: pick a provider, then fill in the account details. */
export function AddAccountDialog() {
  const { t } = useTranslation("accounts");
  const open = useDialogStore((state) => state.open === "addAccount");
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const [provider, setProvider] = useState<AccountProvider | null>(null);

  const close = () => {
    closeDialog();
    setProvider(null);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className={
          provider && provider !== "google" && provider !== "microsoft"
            ? "sm:max-w-xl"
            : "sm:max-w-md"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {provider
              ? t("add.configureTitle", { provider: t(`providers.${provider}`) })
              : t("add.title")}
          </DialogTitle>
          <DialogDescription>
            {provider ? t("add.configureDescription") : t("add.description")}
          </DialogDescription>
        </DialogHeader>
        {provider ? (
          <AccountForm provider={provider} onBack={() => setProvider(null)} onDone={close} />
        ) : (
          <ProviderPicker onSelect={setProvider} />
        )}
      </DialogContent>
    </Dialog>
  );
}
