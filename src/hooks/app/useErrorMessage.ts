import { useTranslation } from "react-i18next";

import { isAppError } from "@models";

/** Human-readable, translated message for errors coming from Rust commands. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown): string => {
    if (isAppError(error)) return t(`errors.kinds.${error.kind}`);
    return t("errors.generic");
  };
}
