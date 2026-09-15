"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, List, Plus, Settings, Tags, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/provider";

type NavItem = { href: string; label: string; Icon: LucideIcon; match: (path: string) => boolean };

function useNavItems() {
  const { m } = useI18n();
  const items: NavItem[] = [
    { href: "/dashboard", label: m.nav.dashboard, Icon: House, match: (p) => p === "/dashboard" },
    { href: "/items", label: m.nav.items, Icon: List, match: (p) => p === "/items" || (p.startsWith("/items/") && p !== "/items/new") },
    { href: "/categories", label: m.nav.categories, Icon: Tags, match: (p) => p.startsWith("/categories") },
    { href: "/settings", label: m.nav.settings, Icon: Settings, match: (p) => p.startsWith("/settings") },
  ];
  return { items, m };
}

export function DesktopNav() {
  const pathname = usePathname();
  const { items, m } = useNavItems();
  return (
    <nav aria-label={m.nav.main} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map(({ href, label, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-control px-3.5 text-[0.95rem] transition-colors hover:bg-surface-muted ${
                  active ? "font-semibold text-ink" : "text-ink-2"
                }`}
              >
                {label}
                {active ? <span aria-hidden className="absolute inset-x-3.5 -bottom-[13px] h-0.5 rounded-full bg-accent" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile bottom navigation: four destinations plus a central Add action (≤ 5 targets). */
export function BottomNav() {
  const pathname = usePathname();
  const { items, m } = useNavItems();
  const [first, second, third, fourth] = items;
  const addActive = pathname === "/items/new";

  const renderItem = ({ href, label, Icon, match }: NavItem) => {
    const active = match(pathname);
    return (
      <li key={href} className="flex-1">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-control text-[0.72rem] leading-none transition-colors ${
            active ? "font-semibold text-ink" : "text-ink-2"
          }`}
        >
          <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${active ? "bg-surface-muted" : ""}`}>
            <Icon className="size-5" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
          </span>
          {label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={m.nav.main} className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-sm md:hidden">
      <ul className="safe-bottom mx-auto flex max-w-lg items-end gap-1 px-2 pt-1.5">
        {renderItem(first!)}
        {renderItem(second!)}
        <li className="flex-1">
          <Link
            href="/items/new"
            aria-current={addActive ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[0.72rem] font-semibold leading-none text-ink"
          >
            <span className="grid size-11 -translate-y-1 place-items-center rounded-2xl bg-primary text-primary-ink shadow-raise">
              <Plus className="size-5.5" aria-hidden strokeWidth={2.25} />
            </span>
            <span className="-mt-1">{m.nav.add}</span>
          </Link>
        </li>
        {renderItem(third!)}
        {renderItem(fourth!)}
      </ul>
    </nav>
  );
}
