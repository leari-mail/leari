import { Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Shown over the composer while files are dragged onto the window. */
export function DropOverlay() {
  const { t } = useTranslation("mail");
  return (
    <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary backdrop-blur-[1px]">
      <Paperclip className="size-6" />
      {t("composer.dropFiles")}
    </div>
  );
}
