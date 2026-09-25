import { SplashScreen } from "@components/common";
import { Welcome } from "@components/onboarding";
import { useAccounts, useNotificationSettings, useSyncEvents, useTrayBadge } from "@hooks";

import { AppShell } from "./AppShell";

/** Mail UI once the database is ready: onboarding without accounts, the three panes otherwise. */
export function Workspace() {
  const { data: accounts, error } = useAccounts();
  useSyncEvents();
  useTrayBadge();
  useNotificationSettings();

  if (!accounts) return <SplashScreen error={error} />;
  return accounts.length === 0 ? <Welcome /> : <AppShell />;
}
