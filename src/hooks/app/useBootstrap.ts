import { useQuery } from "@tanstack/react-query";
import { runMigrations, seedDemoData } from "@db";
import { queryKeys } from "../queryKeys";

async function bootstrap() {
  await runMigrations();
  if (import.meta.env.DEV) await seedDemoData();
  return true;
}

/** Opens the database and applies pending migrations before the UI renders. */
export function useBootstrap() {
  return useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: bootstrap,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
