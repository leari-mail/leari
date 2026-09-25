import { CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAccountSyncStatus, useErrorMessage } from "@hooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui";

interface AccountSyncIndicatorProps {
  accountId: string;
}

/** Spinner while an account syncs, warning icon (with details) when its last sync failed. */
export function AccountSyncIndicator({ accountId }: AccountSyncIndicatorProps) {
  const { t } = useTranslation("mail");
  const status = useAccountSyncStatus(accountId);
  const errorMessage = useErrorMessage();

  if (status?.state === "syncing") {
    return (
      <LoaderCircle
        aria-label={t("sync.syncing")}
        className="size-3.5 shrink-0 animate-spin text-muted-foreground"
      />
    );
  }

  if (status?.state === "error" && status.error) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleAlert
            aria-label={t("sync.failed")}
            className="size-3.5 shrink-0 text-destructive"
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          <p className="font-medium">{errorMessage(status.error)}</p>
          <p className="opacity-80">{status.error.message}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}
