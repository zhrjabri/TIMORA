import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? <div className="text-sm text-ink-2">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="max-w-prose text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({ title, action, children, id, className = "" }: { title: ReactNode; action?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section aria-labelledby={headingId} className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={`rounded-card border border-line bg-surface ${className}`}>{children}</Tag>;
}

export function EmptyState({ icon, title, body, action, children }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-line-strong/50 bg-surface px-6 py-10 text-center">
      {icon ? <div className="grid size-14 place-items-center rounded-2xl bg-surface-muted text-ink">{icon}</div> : null}
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {body ? <p className="text-ink-2">{body}</p> : null}
      </div>
      {action}
      {children}
    </div>
  );
}
