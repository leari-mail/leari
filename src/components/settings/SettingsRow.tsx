import type { ReactNode } from "react";

interface SettingsRowProps {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}

export function SettingsRow({ label, htmlFor, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={htmlFor} className="text-[13px]">
        {label}
      </label>
      {children}
    </div>
  );
}
