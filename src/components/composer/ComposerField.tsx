import type { ReactNode } from "react";

interface ComposerFieldProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

/** Inline "Label: value" row, as in classic mail composers. */
export function ComposerField({ label, htmlFor, children }: ComposerFieldProps) {
  return (
    <div className="flex items-center gap-2 border-b border-border/70 px-4">
      <label htmlFor={htmlFor} className="w-14 shrink-0 text-[13px] text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
