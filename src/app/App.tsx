import { AddAccountDialog } from "@components/accounts";
import { ConfirmDialog, SplashScreen } from "@components/common";
import { ComposerDialog } from "@components/composer";
import { Workspace } from "@components/layout";
import { SettingsDialog } from "@components/settings";
import {
  useApplyTheme,
  useBootstrap,
  useDockVisibility,
  useKeyboardShortcuts,
  useTrayEvents,
} from "@hooks";

export function App() {
  useApplyTheme();
  useDockVisibility();
  useTrayEvents();
  useKeyboardShortcuts();

  const bootstrap = useBootstrap();
  if (!bootstrap.isSuccess) return <SplashScreen error={bootstrap.error} />;

  return (
    <>
      <Workspace />
      <AddAccountDialog />
      <SettingsDialog />
      <ComposerDialog />
      <ConfirmDialog />
    </>
  );
}
