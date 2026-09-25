import { useQuery } from "@tanstack/react-query";

import { oauthService } from "@services";

/** Providers this build can sign in with. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ["oauth", "providers"],
    queryFn: () => oauthService.providers(),
    staleTime: Infinity,
  });
}
