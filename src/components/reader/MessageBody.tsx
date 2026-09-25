import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef } from "react";

import { useInlineImages } from "@hooks";
import type { Message } from "@models";

interface MessageBodyProps {
  message: Message;
}

const CONTENT_ID = "leari-content";

const frameStyles = `
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1d2b; overflow: hidden; }
  body { font: 14px/1.5 Roboto, -apple-system, system-ui, sans-serif; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #3552b8; }
  #${CONTENT_ID} { transform-origin: 0 0; }
`;

function buildDocument(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${frameStyles}</style></head><body><div id="${CONTENT_ID}">${html}</div></body></html>`;
}

/**
 * Fits the email into the frame: fixed-width layouts wider than the reader are scaled down
 * (like Apple Mail / Airmail) instead of scrolling sideways, and the frame grows to the
 * content's height so the reader scrolls as a whole.
 */
function fitContent(frame: HTMLIFrameElement, content: HTMLElement) {
  content.style.transform = "";
  content.style.width = "";

  const available = frame.clientWidth;
  const natural = content.scrollWidth;
  let scale = 1;
  if (available > 0 && natural > available + 1) {
    scale = available / natural;
    content.style.width = `${natural}px`;
    content.style.transform = `scale(${scale})`;
  }
  frame.style.height = `${Math.ceil(content.scrollHeight * scale)}px`;
}

/**
 * HTML bodies render in a sandboxed iframe without scripts; links open in the default
 * browser. Plain-text bodies render as preformatted text.
 */
/** Points `cid:` references at the embedded images' data URLs. */
function resolveInlineImages(html: string, images: Record<string, string> | undefined) {
  if (!images) return html;
  return html.replace(/cid:([^"'\s)>]+)/gi, (reference, id: string) => {
    return images[decodeURIComponent(id)] ?? reference;
  });
}

export function MessageBody({ message }: MessageBodyProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { data: inlineImages } = useInlineImages(message);
  const html = message.bodyHtml ? resolveInlineImages(message.bodyHtml, inlineImages) : null;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !html) return;

    let frameObserver: ResizeObserver | undefined;
    let pending = 0;

    const onLoad = () => {
      const doc = frame.contentDocument;
      const content = doc?.getElementById(CONTENT_ID);
      if (!doc || !content) return;

      const scheduleFit = () => {
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => fitContent(frame, content));
      };
      scheduleFit();

      // Refit when the reader pane is resized and when images finish loading.
      frameObserver = new ResizeObserver(scheduleFit);
      frameObserver.observe(frame);
      for (const image of Array.from(doc.images)) {
        if (!image.complete) image.addEventListener("load", scheduleFit, { once: true });
      }

      doc.addEventListener("click", (event) => {
        const anchor = (event.target as Element).closest("a[href]");
        const href = anchor?.getAttribute("href");
        if (!href) return;
        event.preventDefault();
        void openUrl(href);
      });
    };

    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      frameObserver?.disconnect();
      cancelAnimationFrame(pending);
    };
  }, [html]);

  if (html) {
    return (
      <div className="overflow-hidden rounded-lg bg-white p-4">
        <iframe
          ref={frameRef}
          title={message.subject}
          sandbox="allow-same-origin allow-popups"
          srcDoc={buildDocument(html)}
          className="block w-full border-0"
        />
      </div>
    );
  }

  return (
    <div data-selectable className="text-[14px] leading-relaxed whitespace-pre-wrap">
      {message.bodyText ?? message.snippet}
    </div>
  );
}
