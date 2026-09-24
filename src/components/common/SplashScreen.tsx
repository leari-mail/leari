import { useTranslation } from "react-i18next";
import { LeariLogo } from "@components/brand";

interface SplashScreenProps {
  error?: unknown;
}

export function SplashScreen({ error }: SplashScreenProps) {
  const { t } = useTranslation();

  return (
    <div
      data-tauri-drag-region
      className="flex h-full flex-col items-center justify-center gap-4 bg-background"
    >
      <LeariLogo className="size-20 animate-pulse" />
      <p className="text-sm text-muted-foreground">
        {error ? t("errors.startup") : t("status.starting")}
      </p>
      {error != null && (
        <pre className="max-w-md text-xs whitespace-pre-wrap text-destructive">{String(error)}</pre>
      )}
    </div>
  );
}
