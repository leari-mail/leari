import { Plus, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@components/common";
import { useDialogStore } from "@stores";

export function SidebarFooter() {
  const { t } = useTranslation("mail");
  const openDialog = useDialogStore((state) => state.openDialog);

  return (
    <div className="flex h-10 shrink-0 items-center justify-between px-2">
      <IconButton
        label={t("sidebar.addAccount")}
        icon={<Plus />}
        onClick={() => openDialog("addAccount")}
      />
      <IconButton
        label={t("sidebar.settings")}
        icon={<Settings />}
        onClick={() => openDialog("settings")}
      />
    </div>
  );
}
