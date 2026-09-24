import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";

export function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}
