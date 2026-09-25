import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TooltipProvider } from "@ui";

import { queryClient } from "./queryClient";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={500}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
