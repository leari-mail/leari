import type { ConnectionSecurity } from "@models";
import { useTranslation } from "react-i18next";

import { connectionSecurities } from "@db/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui";

interface SecuritySelectProps {
  id?: string;
  value: ConnectionSecurity;
  onChange: (value: ConnectionSecurity) => void;
}

export function SecuritySelect({ id, value, onChange }: SecuritySelectProps) {
  const { t } = useTranslation("accounts");

  return (
    <Select value={value} onValueChange={(next) => onChange(next as ConnectionSecurity)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {connectionSecurities.map((security) => (
          <SelectItem key={security} value={security}>
            {t(`security.${security}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
