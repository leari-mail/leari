import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Link } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@components/common";
import { cn } from "@lib";
import { Button, Input, Popover, PopoverAnchor, PopoverContent } from "@ui";

interface LinkButtonProps {
  editor: Editor;
  disabled: boolean;
}

/** `example.com` → `https://example.com`; addresses become `mailto:` links. */
function normalizeHref(value: string) {
  const href = value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(href)) return `mailto:${href}`;
  return `https://${href}`;
}

/** Adds, edits or removes the link on the selection. */
export function LinkButton({ editor, disabled }: LinkButtonProps) {
  const { t } = useTranslation("mail");
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isActive("link"),
  });

  const onOpenChange = (next: boolean) => {
    if (next) {
      const href: unknown = editor.getAttributes("link").href;
      setUrl(typeof href === "string" ? href : "");
    }
    setOpen(next);
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!url.trim()) return;
    const href = normalizeHref(url);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !active) {
      chain
        .insertContent({
          type: "text",
          text: url.trim(),
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      chain.setLink({ href }).run();
    }
    setOpen(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span>
          <IconButton
            label={t("composer.format.link")}
            icon={<Link />}
            aria-pressed={active}
            disabled={disabled}
            className={cn(active && "bg-accent text-foreground")}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onOpenChange(!open)}
          />
        </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-80 p-2">
        <form onSubmit={apply} className="flex items-center gap-2">
          <Input
            autoFocus
            value={url}
            placeholder={t("composer.format.linkPlaceholder")}
            aria-label={t("composer.format.link")}
            onChange={(event) => setUrl(event.target.value)}
            className="h-8"
          />
          {active && (
            <Button type="button" variant="ghost" size="sm" onClick={remove}>
              {t("composer.format.unlink")}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!url.trim()}>
            {t("composer.format.apply")}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
