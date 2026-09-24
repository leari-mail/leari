import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ServerPreset } from "@lib";
import { Input, Label } from "@ui";
import { SecuritySelect } from "./SecuritySelect";

interface ServerFieldsProps {
  title: string;
  value: ServerPreset;
  onChange: (value: ServerPreset) => void;
}

/** Host / port / security inputs for an incoming or outgoing server. */
export function ServerFields({ title, value, onChange }: ServerFieldsProps) {
  const { t } = useTranslation("accounts");
  const id = useId();

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </legend>
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-host`}>{t("form.host")}</Label>
          <Input
            id={`${id}-host`}
            required
            value={value.host}
            placeholder="mail.example.com"
            onChange={(event) => onChange({ ...value, host: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-port`}>{t("form.port")}</Label>
          <Input
            id={`${id}-port`}
            required
            type="number"
            value={value.port}
            onChange={(event) => onChange({ ...value, port: Number(event.target.value) })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-security`}>{t("form.security")}</Label>
        <SecuritySelect
          id={`${id}-security`}
          value={value.security}
          onChange={(security) => onChange({ ...value, security })}
        />
      </div>
    </fieldset>
  );
}
