import { SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DragRegion, IconButton } from "@components/common";
import { useComposerStore } from "@stores";

/** Leaves room for the macOS traffic lights and holds the compose button. */
export function SidebarHeader() {
  const { t } = useTranslation("mail");
  const openComposer = useComposerStore((state) => state.open);

  return (
    <DragRegion className="justify-end px-2">
      <IconButton
        label={t("sidebar.compose")}
        icon={<SquarePen />}
        onClick={() => openComposer()}
      />
    </DragRegion>
  );
}
