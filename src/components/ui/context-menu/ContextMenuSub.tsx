import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

export function ContextMenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
  return <ContextMenuPrimitive.Sub data-slot="context-menu-sub" {...props} />;
}
