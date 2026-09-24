import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

export function ContextMenuPortal({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Portal>) {
  return <ContextMenuPrimitive.Portal data-slot="context-menu-portal" {...props} />;
}
