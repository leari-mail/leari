import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";

export function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}
