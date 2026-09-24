export type Platform = "mac" | "windows" | "linux";

export function detectPlatform(): Platform {
  const agent = navigator.userAgent;
  if (agent.includes("Mac")) return "mac";
  if (agent.includes("Windows")) return "windows";
  return "linux";
}
