import { useTranslation } from "react-i18next";

import { LeariLogo } from "@components/brand";
import { DragRegion, EmptyState } from "@components/common";

export function ReaderEmpty() {
  const { t } = useTranslation("mail");

  return (
    <div className="flex h-full flex-col">
      <DragRegion />
      <EmptyState
        className="pb-20"
        icon={<LeariLogo className="size-20 opacity-25 grayscale" />}
        title={t("reader.emptyTitle")}
        description={t("reader.emptyDescription")}
      />
    </div>
  );
}
