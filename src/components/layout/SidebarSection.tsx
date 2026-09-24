import type { ReactNode } from "react";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <section className="space-y-1">
      <h2 className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground/80">
        {title}
      </h2>
      {children}
    </section>
  );
}
