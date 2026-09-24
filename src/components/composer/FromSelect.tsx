import { AccountDot } from "@components/accounts";
import { useAccounts } from "@hooks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui";

interface FromSelectProps {
  id?: string;
  value?: string;
  onChange: (accountId: string) => void;
}

export function FromSelect({ id, value, onChange }: FromSelectProps) {
  const { data: accounts = [] } = useAccounts();

  return (
    <Select value={value ?? accounts[0]?.id} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className="h-10 w-full border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <AccountDot color={account.color} />
            {account.name} &lt;{account.email}&gt;
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
