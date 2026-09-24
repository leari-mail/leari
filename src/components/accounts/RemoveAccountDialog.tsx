import { useTranslation } from "react-i18next";
import { useRemoveAccount } from "@hooks";
import type { Account } from "@models";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui";

interface RemoveAccountDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveAccountDialog({ account, open, onOpenChange }: RemoveAccountDialogProps) {
  const { t } = useTranslation(["accounts", "common"]);
  const removeAccount = useRemoveAccount();

  const remove = () => removeAccount.mutate(account.id, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("accounts:remove")}</DialogTitle>
          <DialogDescription>
            {t("accounts:removeConfirm", { email: account.email })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button variant="destructive" onClick={remove} disabled={removeAccount.isPending}>
            {t("common:actions.remove")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
