import { Avatar, AvatarFallback } from "@ui";
import { colorFromString, initials } from "@lib";
import { cn } from "@lib/utils";

interface SenderAvatarProps {
  name?: string | null;
  address: string;
  className?: string;
}

export function SenderAvatar({ name, address, className }: SenderAvatarProps) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback
        className="text-xs font-medium text-white"
        style={{ backgroundColor: colorFromString(address) }}
      >
        {initials(name || address)}
      </AvatarFallback>
    </Avatar>
  );
}
