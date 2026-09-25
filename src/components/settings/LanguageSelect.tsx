import { useTranslation } from "react-i18next";

import { languages } from "@i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui";

export function LanguageSelect({ id }: { id?: string }) {
  const { i18n } = useTranslation();

  return (
    <Select value={i18n.resolvedLanguage} onValueChange={(code) => void i18n.changeLanguage(code)}>
      <SelectTrigger id={id} size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {languages.map((language) => (
          <SelectItem key={language.code} value={language.code}>
            {language.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
