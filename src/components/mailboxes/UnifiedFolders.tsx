import type { MailboxRole } from "@models";

import { UnifiedFolderItem } from "./UnifiedFolderItem";

const unifiedRoles: MailboxRole[] = ["inbox", "starred", "sent", "drafts", "archive", "trash"];

/** Smart folders aggregating every account. */
export function UnifiedFolders() {
  return (
    <div className="space-y-px">
      {unifiedRoles.map((role) => (
        <UnifiedFolderItem key={role} role={role} />
      ))}
    </div>
  );
}
