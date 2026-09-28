import { syncService } from "@services";

/**
 * Runs a per-message change (which returns the message's account id) for several messages,
 * then pushes each touched account once.
 */
export async function applyToMessages(
  ids: string[],
  change: (id: string) => Promise<string | undefined>,
): Promise<void> {
  const accounts = new Set<string>();
  for (const id of ids) {
    const accountId = await change(id);
    if (accountId) accounts.add(accountId);
  }
  for (const accountId of accounts) void syncService.push(accountId);
}
