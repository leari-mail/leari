import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useErrorMessage } from "@hooks";
import { useConfirmStore } from "@stores";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui";

/** The app's confirmation for destructive actions; requests come from `useConfirmStore`. */
export function ConfirmDialog() {
  const { t } = useTranslation("common");
  const request = useConfirmStore((state) => state.request);
  const close = useConfirmStore((state) => state.close);
  const errorMessage = useErrorMessage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const onOpenChange = (open: boolean) => {
    if (open || pending) return;
    setError(null);
    close();
  };

  const confirm = async () => {
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      await request.onConfirm();
      close();
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        {error !== null && (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage(error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("actions.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {pending && <LoaderCircle className="animate-spin" />}
            {request?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
