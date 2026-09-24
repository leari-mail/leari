import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

export function SelectGroup({ ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}
