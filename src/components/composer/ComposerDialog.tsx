import { Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useComposerStore } from "@stores";
import { Button, Dialog, DialogContent, DialogTitle, Input, Textarea } from "@ui";
import { ComposerField } from "./ComposerField";
import { FromSelect } from "./FromSelect";

const bareInput =
  "h-10 rounded-none border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent";

export function ComposerDialog() {
  const { t } = useTranslation("mail");
  const { isOpen, draft, update, close } = useComposerStore();
  const [notice, setNotice] = useState(false);

  const send = (event: FormEvent) => {
    event.preventDefault();
    // TODO: hand the draft to the Rust SMTP sender.
    setNotice(true);
  };

  const onOpenChange = (open: boolean) => {
    if (open) return;
    setNotice(false);
    close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(620px,85vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <form onSubmit={send} className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-12 items-center gap-2 border-b border-border/70 px-4">
            <DialogTitle className="flex-1 text-sm">
              {draft.subject || t("composer.title")}
            </DialogTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              {t("composer.discard")}
            </Button>
            <Button type="submit" size="sm">
              <Send />
              {t("composer.send")}
            </Button>
          </div>

          <ComposerField label={t("composer.from")} htmlFor="composer-from">
            <FromSelect
              id="composer-from"
              value={draft.accountId}
              onChange={(accountId) => update({ accountId })}
            />
          </ComposerField>
          <ComposerField label={t("composer.to")} htmlFor="composer-to">
            <Input
              id="composer-to"
              autoFocus
              value={draft.to}
              onChange={(event) => update({ to: event.target.value })}
              className={bareInput}
            />
          </ComposerField>
          <ComposerField label={t("composer.cc")} htmlFor="composer-cc">
            <Input
              id="composer-cc"
              value={draft.cc}
              onChange={(event) => update({ cc: event.target.value })}
              className={bareInput}
            />
          </ComposerField>
          <ComposerField label={t("composer.subject")} htmlFor="composer-subject">
            <Input
              id="composer-subject"
              value={draft.subject}
              onChange={(event) => update({ subject: event.target.value })}
              className={bareInput}
            />
          </ComposerField>

          <Textarea
            value={draft.body}
            placeholder={t("composer.bodyPlaceholder")}
            onChange={(event) => update({ body: event.target.value })}
            className="min-h-0 flex-1 resize-none rounded-none border-0 px-4 py-3 text-[14px] shadow-none focus-visible:ring-0 dark:bg-transparent"
          />

          {notice && (
            <p className="bg-highlight/25 px-4 py-2 text-xs text-foreground">
              {t("composer.notImplemented")}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
