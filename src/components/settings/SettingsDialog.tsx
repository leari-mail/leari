import { useTranslation } from "react-i18next";

import { LeariLogo } from "@components/brand";
import { useAppVersion } from "@hooks";
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
  const version = useAppVersion();
  const notifyNewMail = useSettingsStore((state) => state.notifyNewMail);
  const setNotifyNewMail = useSettingsStore((state) => state.setNotifyNewMail);
  const showUnreadInMenuBar = useSettingsStore((state) => state.showUnreadInMenuBar);
  const setShowUnreadInMenuBar = useSettingsStore((state) => state.setShowUnreadInMenuBar);

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

        <section>
          <h3 className="text-xs font-medium text-muted-foreground uppercase">
            {t("notifications")}
          </h3>
          <SettingsRow label={t("notifyNewMail")} htmlFor="settings-notify">
            <Switch
              id="settings-notify"
              checked={notifyNewMail}
              onCheckedChange={setNotifyNewMail}
            />
          </SettingsRow>
          <SettingsRow label={t("showUnreadInMenuBar")} htmlFor="settings-menubar-count">
            <Switch
              id="settings-menubar-count"
              checked={showUnreadInMenuBar}
              onCheckedChange={setShowUnreadInMenuBar}
            />
          </SettingsRow>
        </section>

        <Separator />

        <div className="flex items-center gap-3">
          <LeariLogo className="size-10" />
          <div className="space-y-0.5">
            {version && <p className="text-xs font-medium">leari {version}</p>}
            <p className="text-xs text-muted-foreground">{t("about")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
