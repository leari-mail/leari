import type { JSONContent } from "@tiptap/react";

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineText(node: JSONContent): string {
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") {
    const text = node.text ?? "";
    const link = node.marks?.find((mark) => mark.type === "link");
    const href = typeof link?.attrs?.href === "string" ? link.attrs.href : undefined;
    return href && href !== text && `mailto:${text}` !== href ? `${text} <${href}>` : text;
  }
  return (node.content ?? []).map(inlineText).join("");
}

function prefixLines(text: string, first: string, rest = " ".repeat(first.length)) {
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? first : rest) + line)
    .join("\n");
}

function blockText(node: JSONContent): string {
  const children = node.content ?? [];
  switch (node.type ?? "") {
    case "bulletList":
      return children.map((item) => prefixLines(blocksText(item.content ?? []), "- ")).join("\n");
    case "orderedList": {
      const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
      return children
        .map((item, index) => prefixLines(blocksText(item.content ?? []), `${start + index}. `))
        .join("\n");
    }
    case "blockquote":
      return blocksText(children)
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "horizontalRule":
      return "---";
    default:
      return inlineText(node);
  }
}

function blocksText(blocks: JSONContent[]) {
  return blocks.map(blockText).join("\n");
}

/** Plain-text version of a composer document, for the text/plain part of outgoing mail. */
export function docToText(doc: JSONContent) {
  return blocksText(doc.content ?? []).replace(/\s+$/, "");
}

/** Composer content for a reply or forward: an empty line to write in, then the quoted original. */
export function quoteHtml(author: string, text: string) {
  const lines = text.replace(/\s+$/, "").split(/\r?\n/);
  const quoted = lines.map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<p></p>")).join("");
  return `<p></p><p>${escapeHtml(author)}:</p><blockquote>${quoted}</blockquote>`;
}

const bodyStyle =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; " +
  "font-size: 14px; line-height: 1.5;";
const quoteStyle =
  "margin: 0 0 0 0.8ex; border-left: 2px solid #ccc; padding-left: 1ex; color: #555;";

/**
 * The composer's HTML as a standalone email body. Mail clients ignore stylesheets, so the few
 * styles that matter are inlined: paragraphs keep the composer's line spacing (empty ones stay as
 * blank lines) and quotes get the usual left rule.
 */
export function toEmailHtml(bodyHtml: string) {
  const body = bodyHtml
    .replace(/<p><\/p>/g, '<p style="margin: 0;"><br></p>')
    .replace(/<p>/g, '<p style="margin: 0;">')
    .replace(/<blockquote>/g, `<blockquote style="${quoteStyle}">`);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="${bodyStyle}">${body}</body></html>`;
}
