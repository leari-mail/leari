import { useTranslation } from "react-i18next";
import { type Theme, useSettingsStore } from "@stores";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui";

const themes: Theme[] = ["system", "light", "dark"];

export function ThemeSelect({ id }: { id?: string }) {
  const { t } = useTranslation("settings");
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  return (
    <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
      <SelectTrigger id={id} size="sm" className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {themes.map((option) => (
          <SelectItem key={option} value={option}>
            {t(`theme.${option}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
