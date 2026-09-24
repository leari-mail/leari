import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "radix-ui";

export function ContextMenu({ ...props }: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}
