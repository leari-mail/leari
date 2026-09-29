import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { useErrorMessage } from "@hooks";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@ui";

interface FolderNameDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  /** Prefilled name (renaming). */
  initialName?: string;
  onOpenChange: (open: boolean) => void;
  /** Creates or renames; the dialog closes when it resolves and shows the error if it fails. */
  onSubmit: (name: string) => Promise<unknown>;
}

/** Asks for a folder name: new folder, new subfolder or rename. */
export function FolderNameDialog({
  open,
  title,
  submitLabel,
  initialName = "",
  onOpenChange,
  onSubmit,
}: FolderNameDialogProps) {
  const { t } = useTranslation(["mail", "common"]);
  const errorMessage = useErrorMessage();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const change = (next: boolean) => {
    if (pending) return;
    if (next) setName(initialName);
    setError(null);
    onOpenChange(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      onOpenChange(false);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">{t("mail:folderMenu.nameLabel")}</Label>
            <Input
              id="folder-name"
              autoFocus
              value={name}
              disabled={pending}
              onChange={(event) => setName(event.target.value)}
            />
            {error !== null && (
              <p role="alert" className="text-xs text-destructive">
                {errorMessage(error)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => change(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
