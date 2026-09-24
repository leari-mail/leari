import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef } from "react";
import type { Message } from "@models";

interface MessageBodyProps {
  message: Message;
}

const frameStyles = `
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1d2b; }
  body { font: 14px/1.5 Roboto, -apple-system, system-ui, sans-serif; word-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  a { color: #3552b8; }
`;

function buildDocument(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${frameStyles}</style></head><body>${html}</body></html>`;
}

/**
 * HTML bodies render in a sandboxed iframe without scripts; its height follows the content
 * and links open in the default browser. Plain-text bodies render as preformatted text.
 */
export function MessageBody({ message }: MessageBodyProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !message.bodyHtml) return;

    let observer: ResizeObserver | undefined;
    const onLoad = () => {
      const doc = frame.contentDocument;
      if (!doc) return;

      const fit = () => {
        frame.style.height = `${doc.documentElement.scrollHeight}px`;
      };
      fit();
      observer = new ResizeObserver(fit);
      observer.observe(doc.body);

      doc.addEventListener("click", (event) => {
        const anchor = (event.target as Element).closest("a[href]");
        if (!anchor) return;
        event.preventDefault();
        void openUrl(anchor.getAttribute("href")!);
      });
    };

    frame.addEventListener("load", onLoad);
    return () => {
      frame.removeEventListener("load", onLoad);
      observer?.disconnect();
    };
  }, [message.bodyHtml]);

  if (message.bodyHtml) {
    return (
      <div className="overflow-hidden rounded-lg bg-white p-4">
        <iframe
          ref={frameRef}
          title={message.subject}
          sandbox="allow-same-origin allow-popups"
          srcDoc={buildDocument(message.bodyHtml)}
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
