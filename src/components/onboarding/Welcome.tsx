import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LeariLogo } from "@components/brand";
import { DragRegion } from "@components/common";
import { useDialogStore } from "@stores";
import { Button } from "@ui";

/** Shown when there are no accounts yet. */
export function Welcome() {
  const { t } = useTranslation(["accounts", "common", "mail"]);
  const openDialog = useDialogStore((state) => state.openDialog);

  return (
    <div className="flex h-full flex-col bg-background">
      <DragRegion />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
        <LeariLogo className="size-28" />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">{t("accounts:empty.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("common:tagline")}</p>
          <p className="text-sm text-muted-foreground">{t("accounts:empty.description")}</p>
        </div>
        <Button onClick={() => openDialog("addAccount")}>
          <Plus />
          {t("mail:sidebar.addAccount")}
        </Button>
      </div>
    </div>
  );
}
