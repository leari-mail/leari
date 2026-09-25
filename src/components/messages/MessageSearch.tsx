import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useMailStore } from "@stores";
import { Input } from "@ui";

export function MessageSearch() {
  const { t } = useTranslation("mail");
  const query = useMailStore((state) => state.searchQuery);
  const setQuery = useMailStore((state) => state.setSearchQuery);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        placeholder={t("list.search")}
        onChange={(event) => setQuery(event.target.value)}
        className="h-7 rounded-md border-transparent bg-muted/70 pl-8 text-[13px] shadow-none"
      />
    </div>
  );
}
