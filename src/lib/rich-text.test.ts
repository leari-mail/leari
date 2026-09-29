import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { docToText, quoteHtml, toEmailHtml } from "./rich-text";

const text = (value: string, marks?: JSONContent["marks"]): JSONContent => ({
  type: "text",
  text: value,
  marks,
});
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const item = (...content: JSONContent[]): JSONContent => ({ type: "listItem", content });

describe("docToText", () => {
  it("keeps one line per paragraph and blank lines for empty ones", () => {
    const doc = { type: "doc", content: [p(text("Hi Ana,")), p(), p(text("Thanks!"))] };
    expect(docToText(doc)).toBe("Hi Ana,\n\nThanks!");
  });

  it("drops formatting but keeps link targets", () => {
    const doc = {
      type: "doc",
      content: [
        p(
          text("Read "),
          text("this", [{ type: "bold" }, { type: "link", attrs: { href: "https://x.org" } }]),
          text(" or "),
          text("https://y.org", [{ type: "link", attrs: { href: "https://y.org" } }]),
        ),
      ],
    };
    expect(docToText(doc)).toBe("Read this <https://x.org> or https://y.org");
  });

  it("marks list items and quoted lines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "bulletList", content: [item(p(text("one"))), item(p(text("two")))] },
        { type: "orderedList", attrs: { start: 1 }, content: [item(p(text("first")))] },
        { type: "blockquote", content: [p(text("quoted")), p()] },
        p(text("a"), { type: "hardBreak" }, text("b")),
      ],
    };
    expect(docToText(doc)).toBe("- one\n- two\n1. first\n> quoted\n>\na\nb");
  });
});

describe("quoteHtml", () => {
  it("escapes the original and quotes it below an empty line", () => {
    expect(quoteHtml("Ana <ana@x.com>", "Hello\n\n<b>bye</b>\n")).toBe(
      "<p></p><p>Ana &lt;ana@x.com&gt;:</p><blockquote><p>Hello</p><p></p><p>&lt;b&gt;bye&lt;/b&gt;</p></blockquote>",
    );
  });
});

describe("toEmailHtml", () => {
  it("inlines paragraph and quote styles", () => {
    const html = toEmailHtml("<p>Hi</p><p></p><blockquote><p>old</p></blockquote>");
    expect(html).toContain('<p style="margin: 0;">Hi</p><p style="margin: 0;"><br></p>');
    expect(html).toContain('<blockquote style="margin: 0 0 0 0.8ex;');
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });
});
