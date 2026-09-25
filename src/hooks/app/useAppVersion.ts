import { useQuery } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";

/** The running app's version (from package.json, through tauri.conf.json). */
export function useAppVersion() {
  return useQuery({ queryKey: ["app", "version"], queryFn: getVersion, staleTime: Infinity }).data;
}
