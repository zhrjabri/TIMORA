"use client";

import Link from "next/link";
import type { ItemCardData } from "@/lib/items/present";
import { StatusBadge, STATUS_TEXT_CLASS } from "@/components/ui/status-badge";
import { ItemIcon } from "./item-icon";
import { DoneNowButton } from "./done-now-button";

/**
 * One item. The whole title area links to the details page; "Done now" is a separate
 * control so a tap on the card never records a completion by accident.
 */
export function ItemCard({ item, showDone = true, emphasis = false }: { item: ItemCardData; showDone?: boolean; emphasis?: boolean }) {
  return (
    <article
      className={`group relative flex flex-col gap-3 rounded-card border bg-surface p-4 transition-shadow hover:shadow-raise sm:flex-row sm:items-center ${
        emphasis ? "border-line-strong/40" : "border-line"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <ItemIcon icon={item.icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 text-[1.02rem] font-semibold leading-snug text-ink">
              <Link href={`/items/${item.id}`} dir="auto" className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-focus">
                {item.name}
              </Link>
            </h3>
            <StatusBadge status={item.status} label={item.text.status} size="sm" />
          </div>
          <p className={`text-sm font-medium ${STATUS_TEXT_CLASS[item.status]}`}>{item.text.due}</p>
          <p className="text-sm text-ink-2">{item.text.meta}</p>
        </div>
      </div>
      {showDone && !item.archived ? (
        <div className="relative z-10 flex sm:shrink-0">
          <DoneNowButton
            itemId={item.id}
            itemName={item.name}
            labelWithName
            size="md"
            variant={emphasis ? "primary" : "secondary"}
            className="w-full sm:w-auto"
          />
        </div>
      ) : null}
    </article>
  );
}
