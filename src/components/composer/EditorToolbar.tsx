import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  TextQuote,
  Underline,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { IconButton } from "@components/common";
import { cn } from "@lib";
import { Separator } from "@ui";

import { LinkButton } from "./LinkButton";

interface EditorToolbarProps {
  editor: Editor;
}

const activeClass = "bg-accent text-foreground";

/** Formatting buttons above the message body. */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { t } = useTranslation("mail");
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      editable: current.isEditable,
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
    }),
  });

  const buttons = [
    { key: "bold", icon: <Bold />, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", icon: <Italic />, run: () => editor.chain().focus().toggleItalic().run() },
    {
      key: "underline",
      icon: <Underline />,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: "strike",
      icon: <Strikethrough />,
      run: () => editor.chain().focus().toggleStrike().run(),
    },
  ] as const;
  const blocks = [
    {
      key: "bulletList",
      icon: <List />,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      key: "orderedList",
      icon: <ListOrdered />,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "blockquote",
      icon: <TextQuote />,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ] as const;

  return (
    <div
      role="toolbar"
      aria-label={t("composer.format.toolbar")}
      className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border/70 px-3"
    >
      {buttons.map(({ key, icon, run }) => (
        <IconButton
          key={key}
          label={t(`composer.format.${key}`)}
          icon={icon}
          aria-pressed={state[key]}
          disabled={!state.editable}
          className={cn(state[key] && activeClass)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={run}
        />
      ))}
      <Separator orientation="vertical" className="mx-1 h-4!" />
      {blocks.map(({ key, icon, run }) => (
        <IconButton
          key={key}
          label={t(`composer.format.${key}`)}
          icon={icon}
          aria-pressed={state[key]}
          disabled={!state.editable}
          className={cn(state[key] && activeClass)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={run}
        />
      ))}
      <Separator orientation="vertical" className="mx-1 h-4!" />
      <LinkButton editor={editor} disabled={!state.editable} />
      <IconButton
        label={t("composer.format.clear")}
        icon={<RemoveFormatting />}
        disabled={!state.editable}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />
    </div>
  );
}
