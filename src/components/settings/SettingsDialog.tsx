import { useTranslation } from "react-i18next";
import { LeariLogo } from "@components/brand";
import { useDialogStore, useSettingsStore } from "@stores";
import { Dialog, DialogContent, DialogHeader, DialogTitle, Separator, Switch } from "@ui";
import { LanguageSelect } from "./LanguageSelect";
import { SettingsRow } from "./SettingsRow";
import { ThemeSelect } from "./ThemeSelect";

export function SettingsDialog() {
  const { t } = useTranslation("settings");
  const open = useDialogStore((state) => state.open === "settings");
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const markAsReadOnOpen = useSettingsStore((state) => state.markAsReadOnOpen);
  const setMarkAsReadOnOpen = useSettingsStore((state) => state.setMarkAsReadOnOpen);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("appearance")}</h3>
          <SettingsRow label={t("theme.label")} htmlFor="settings-theme">
            <ThemeSelect id="settings-theme" />
          </SettingsRow>
          <SettingsRow label={t("language")} htmlFor="settings-language">
            <LanguageSelect id="settings-language" />
          </SettingsRow>
        </section>

        <Separator />

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("reading")}</h3>
          <SettingsRow label={t("markAsReadOnOpen")} htmlFor="settings-mark-read">
            <Switch
              id="settings-mark-read"
              checked={markAsReadOnOpen}
              onCheckedChange={setMarkAsReadOnOpen}
            />
          </SettingsRow>
        </section>

        <Separator />

        <div className="flex items-center gap-3">
          <LeariLogo className="size-10" />
          <p className="text-xs text-muted-foreground">{t("about")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
