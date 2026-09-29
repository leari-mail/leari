import { Placeholder } from "@tiptap/extensions";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect } from "react";

import { docToText } from "@lib";

import { EditorToolbar } from "./EditorToolbar";

interface RichTextEditorProps {
  /** Initial HTML. Later changes are not pushed into the editor. */
  content: string;
  placeholder: string;
  autoFocus: boolean;
  disabled: boolean;
  onChange: (html: string, text: string) => void;
}

/** ⌘↵ / Ctrl+↵ sends (handled by the composer), so it must not also insert a line break. */
const SendShortcut = Extension.create({
  name: "sendShortcut",
  priority: 1000,
  addKeyboardShortcuts: () => ({ "Mod-Enter": () => true }),
});

/** The message body: a small rich text editor (TipTap) with a formatting toolbar. */
export function RichTextEditor({
  content,
  placeholder,
  autoFocus,
  disabled,
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      SendShortcut,
    ],
    content,
    autofocus: autoFocus ? "start" : false,
    editorProps: { attributes: { class: "rich-text min-h-full px-4 py-3 outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), docToText(editor.getJSON())),
  });

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} className="min-h-0 flex-1 overflow-y-auto text-[14px]" />
    </div>
  );
}
