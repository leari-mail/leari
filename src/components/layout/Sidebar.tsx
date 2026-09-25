import { useTranslation } from "react-i18next";

import { AccountList } from "@components/accounts";
import { UnifiedFolders } from "@components/mailboxes";
import { ScrollArea } from "@ui";

import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarSection } from "./SidebarSection";

/** Left pane, translucent over the native window vibrancy. */
export function Sidebar() {
  const { t } = useTranslation("mail");

  return (
    <aside className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <SidebarHeader />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-2 pb-4">
          <SidebarSection title={t("sidebar.favorites")}>
            <UnifiedFolders />
          </SidebarSection>
          <SidebarSection title={t("sidebar.accounts")}>
            <AccountList />
          </SidebarSection>
        </div>
      </ScrollArea>
      <SidebarFooter />
    </aside>
  );
}
