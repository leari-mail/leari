import { useTranslation } from "react-i18next";

import { isAppError } from "@models";

/** Human-readable, translated message for errors coming from Rust commands. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (isAppError(error) && error.kind === "invalid") {
      return error.message
        ? t("errors.kinds.invalid", { detail: error.message })
        : t("errors.noRecipients");
    }
    if (isAppError(error) && error.kind === "tooLarge") {
      return t("errors.kinds.tooLarge", { limit: "18 MB" });
    }
    if (isAppError(error)) return t(`errors.kinds.${error.kind}`);
    if (error instanceof Error && error.message) return error.message;
    return t("errors.generic");
  };
}
