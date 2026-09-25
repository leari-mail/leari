/** Best-effort text for anything thrown or rejected (Error, Rust command error, string…). */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return JSON.stringify(error);
}
