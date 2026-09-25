import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AccountProvider } from "@models";

import { ProviderIcon } from "./ProviderIcon";

interface ProviderOptionProps {
  provider: AccountProvider;
  onSelect: (provider: AccountProvider) => void;
}

export function ProviderOption({ provider, onSelect }: ProviderOptionProps) {
  const { t } = useTranslation("accounts");

  return (
    <button
      type="button"
      onClick={() => onSelect(provider)}
      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/30 hover:bg-accent"
    >
      <ProviderIcon provider={provider} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(`providers.${provider}`)}</p>
        <p className="text-xs text-muted-foreground">{t(`providerDescriptions.${provider}`)}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );
}
