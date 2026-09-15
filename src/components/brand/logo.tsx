import { MARK_COMPACT, MARK_PRIMARY } from "@/lib/brand/marks";
import type { Locale } from "@/i18n/config";

type MarkProps = {
  variant?: "primary" | "compact";
  className?: string;
  /** Use "mono" wherever the accent would fall on a low-contrast ground. */
  tone?: "brand" | "mono";
  title?: string;
};

/**
 * TIMORA mark. Ink follows `currentColor`; the diamond uses the brand gold.
 * Direction is fixed and never mirrored, even inside `dir="ltr"` layouts.
 */
export function Mark({ variant = "primary", className, tone = "brand", title }: MarkProps) {
  const g = variant === "compact" ? MARK_COMPACT : MARK_PRIMARY;
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={g.strokes} fill="none" stroke="currentColor" strokeWidth={g.strokeWidth} strokeLinecap="round" />
      <path d={g.diamond} fill={tone === "mono" ? "currentColor" : "var(--brand-gold)"} />
    </svg>
  );
}

/** Horizontal lockup: mark + name in the interface language. The mark leads in reading order. */
export function Lockup({
  locale,
  variant = "primary",
  className = "",
  markClassName = "size-8",
}: {
  locale: Locale;
  variant?: "primary" | "compact";
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark variant={variant} className={markClassName} />
      {locale === "ar" ? (
        <span className="font-display text-xl font-semibold leading-none">تيمورا</span>
      ) : (
        <span className="font-display text-base font-medium leading-none tracking-[0.24em]">TIMORA</span>
      )}
    </span>
  );
}
