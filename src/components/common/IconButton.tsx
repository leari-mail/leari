import type { ComponentProps, ReactNode } from "react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@ui";
import { cn } from "@lib/utils";

interface IconButtonProps extends Omit<ComponentProps<typeof Button>, "children"> {
  label: string;
  icon: ReactNode;
}

/** Ghost icon button with a tooltip, used in toolbars. */
export function IconButton({ label, icon, className, ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          className={cn("text-muted-foreground hover:text-foreground", className)}
          {...props}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
