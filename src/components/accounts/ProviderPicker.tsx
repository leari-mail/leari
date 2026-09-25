import { accountProviders } from "@db/schema";
import type { AccountProvider } from "@models";

import { ProviderOption } from "./ProviderOption";

interface ProviderPickerProps {
  onSelect: (provider: AccountProvider) => void;
}

export function ProviderPicker({ onSelect }: ProviderPickerProps) {
  return (
    <div className="space-y-2">
      {accountProviders.map((provider) => (
        <ProviderOption key={provider} provider={provider} onSelect={onSelect} />
      ))}
    </div>
  );
}
