import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

export function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}
