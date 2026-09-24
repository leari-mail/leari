import { SplashScreen } from "@components/common";
import { Welcome } from "@components/onboarding";
import { useAccounts } from "@hooks";
import { AppShell } from "./AppShell";

/** Mail UI once the database is ready: onboarding without accounts, the three panes otherwise. */
export function Workspace() {
  const { data: accounts, error } = useAccounts();

  if (!accounts) return <SplashScreen error={error} />;
  return accounts.length === 0 ? <Welcome /> : <AppShell />;
}
