import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

export function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />;
}
