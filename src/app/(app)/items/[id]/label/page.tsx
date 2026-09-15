import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { getEnv } from "@/lib/env";
import { getItemView } from "@/lib/items/queries";
import { qrUrl } from "@/lib/qr";
import { uuidSchema } from "@/lib/validation/schemas";
import { Mark } from "@/components/brand/logo";
import { QrCode } from "@/components/items/qr-code";
import { PrintButton } from "@/components/items/print-button";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.label.title, robots: { index: false } };
}

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ locale, dir, m }, item] = await Promise.all([getI18n(), getItemView(id)]);
  if (!item) notFound();
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-8">
      <div className="no-print flex w-full flex-col gap-4">
        <Link href={`/items/${item.id}`} className="inline-flex min-h-11 items-center gap-2 self-start rounded-control text-sm text-ink-2 hover:text-ink">
          <BackIcon className="size-4" aria-hidden />
          {item.name}
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink">{m.label.title}</h1>
        <p className="text-ink-2">{m.label.instructions}</p>
        <PrintButton label={m.label.print} />
      </div>

      {/* Printed label: always black on white for scanner reliability, independent of the app theme. */}
      <article
        className="flex w-[64mm] flex-col items-center gap-[3mm] rounded-[3mm] border border-[#111] bg-white p-[5mm] text-[#111] print:rounded-none"
        style={{ breakInside: "avoid" }}
        aria-label={m.label.title}
      >
        <div className="flex w-full items-center justify-between gap-[2mm]">
          <span className="inline-flex items-center gap-[1.5mm]">
            <Mark variant="compact" tone="brand" className="h-[7mm] w-[7mm] text-[#111]" />
            <span className="font-display text-[3.4mm] font-medium tracking-[0.2em]">TIMORA</span>
          </span>
          <span className="font-display text-[3.6mm] font-semibold" lang="ar" dir="rtl">
            تيمورا
          </span>
        </div>
        <QrCode value={qrUrl(getEnv().NEXT_PUBLIC_SITE_URL, item.qr_token)} label={fmt(m.item.qrImageAlt, { name: item.name })} className="h-[54mm] w-[54mm]" />
        <p className="w-full text-center text-[4.2mm] leading-tight font-semibold break-words" dir="auto">
          {item.name}
        </p>
        <p className="text-center text-[2.8mm] text-[#444]" lang={locale}>
          {m.label.scan}
        </p>
      </article>
    </div>
  );
}
