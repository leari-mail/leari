import { QueryClient } from "@tanstack/react-query";

/** Data comes from the local SQLite database, so there is no need to refetch on focus. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
