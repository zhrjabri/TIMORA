import { AppIcon } from "@/components/ui/app-icon";

export function ItemIcon({ icon, size = "md" }: { icon: string | null; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "size-9 rounded-xl", md: "size-11 rounded-xl", lg: "size-14 rounded-2xl" }[size];
  const glyph = { sm: "size-4.5", md: "size-5", lg: "size-6.5" }[size];
  return (
    <span className={`grid shrink-0 place-items-center bg-surface-muted text-ink ${box}`} aria-hidden>
      <AppIcon iconKey={icon} className={glyph} strokeWidth={1.75} />
    </span>
  );
}
