import type { MailboxRole } from "@models";
import {
  Archive,
  File,
  Folder,
  Inbox,
  type LucideProps,
  OctagonAlert,
  Send,
  Star,
  Trash2,
} from "lucide-react";

const icons: Record<MailboxRole, React.ComponentType<LucideProps>> = {
  inbox: Inbox,
  starred: Star,
  sent: Send,
  drafts: File,
  archive: Archive,
  spam: OctagonAlert,
  trash: Trash2,
  custom: Folder,
};

interface MailboxIconProps extends LucideProps {
  role: MailboxRole;
}

export function MailboxIcon({ role, ...props }: MailboxIconProps) {
  const Icon = icons[role];
  return <Icon {...props} />;
}
