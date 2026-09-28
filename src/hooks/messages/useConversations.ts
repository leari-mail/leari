import { useMemo } from "react";

import { groupConversations, singleMessages } from "@lib";
import { useSettingsStore } from "@stores";

import { useMessages } from "./useMessages";

/** The current folder's messages as list rows: grouped by conversation unless turned off. */
export function useConversations() {
  const query = useMessages();
  const grouped = useSettingsStore((state) => state.groupByConversation);
  const conversations = useMemo(
    () => (grouped ? groupConversations : singleMessages)(query.data ?? []),
    [grouped, query.data],
  );
  return { ...query, conversations };
}
