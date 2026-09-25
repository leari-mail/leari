import { LoaderCircle, Send } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { useAccounts, useErrorMessage, useSendMessage } from "@hooks";
import { useComposerStore } from "@stores";
import { Button, Dialog, DialogContent, DialogTitle, Input, Textarea } from "@ui";

import { ComposerField } from "./ComposerField";
import { FromSelect } from "./FromSelect";

const bareInput =
  "h-10 rounded-none border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent";

export function ComposerDialog() {
  const { t } = useTranslation("mail");
  const { isOpen, draft, update, close } = useComposerStore();
  const { data: accounts = [] } = useAccounts();
  const sendMessage = useSendMessage();
  const errorMessage = useErrorMessage();

  const accountId = draft.accountId ?? accounts[0]?.id;
  const sending = sendMessage.isPending;

  const onOpenChange = (open: boolean) => {
    if (open || sending) return;
    sendMessage.reset();
    close();
  };

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    if (!accountId || sending) return;
    sendMessage.mutate(
      {
        accountId,
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        body: draft.body,
        replyToMessageId: draft.replyToMessageId,
      },
      {
        onSuccess: () => {
          sendMessage.reset();
          close();
        },
      },
    );
  };

  // ⌘↵ / Ctrl+↵ sends from anywhere in the composer.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={onKeyDown}
        className="flex h-[min(640px,85vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <form onSubmit={send} className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-12 items-center gap-2 border-b border-border/70 px-4">
            <DialogTitle className="flex-1 truncate text-sm">
              {draft.subject || t("composer.title")}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={sending}
              onClick={() => onOpenChange(false)}
            >
              {t("composer.discard")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={sending || !accountId}
              title={t("composer.sendShortcut")}
            >
              {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
              {sending ? t("composer.sending") : t("composer.send")}
            </Button>
          </div>

          <fieldset disabled={sending} className="flex min-h-0 flex-1 flex-col">
            <ComposerField label={t("composer.from")} htmlFor="composer-from">
              <FromSelect
                id="composer-from"
                value={accountId}
                onChange={(value) => update({ accountId: value })}
              />
            </ComposerField>
            <ComposerField label={t("composer.to")} htmlFor="composer-to">
              <Input
                id="composer-to"
                autoFocus={!draft.to}
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
            <ComposerField label={t("composer.bcc")} htmlFor="composer-bcc">
              <Input
                id="composer-bcc"
                value={draft.bcc}
                onChange={(event) => update({ bcc: event.target.value })}
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
              autoFocus={!!draft.to}
              value={draft.body}
              placeholder={t("composer.bodyPlaceholder")}
              onChange={(event) => update({ body: event.target.value })}
              className="min-h-0 flex-1 resize-none rounded-none border-0 px-4 py-3 text-[14px] shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </fieldset>

          {sendMessage.isError && (
            <p
              role="alert"
              className="border-t border-border/70 px-4 py-2 text-xs text-destructive"
            >
              {errorMessage(sendMessage.error)}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
