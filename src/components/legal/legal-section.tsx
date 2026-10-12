import type { ReactNode } from "react";

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="grid gap-3 border-b border-border py-7 last:border-b-0">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="grid gap-3 text-sm leading-7 text-muted-foreground sm:text-base">{children}</div>
    </section>
  );
}
