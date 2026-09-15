import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { getUserToday } from "@/lib/auth";
import { getItemView, listHistory } from "@/lib/items/queries";
import { uuidSchema } from "@/lib/validation/schemas";
import { Card, PageHeader } from "@/components/ui/misc";
import { HistoryList } from "@/components/items/history-list";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.history.title, robots: { index: false } };
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const [{ locale, dir, m }, { timeZone }, item, records] = await Promise.all([getI18n(), getUserToday(), getItemView(id), listHistory(id)]);
  if (!item) notFound();
  const BackIcon = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href={`/items/${item.id}`} className="inline-flex min-h-11 items-center gap-2 self-start rounded-control text-sm text-ink-2 hover:text-ink">
        <BackIcon className="size-4" aria-hidden />
        {item.name}
      </Link>
      <PageHeader title={m.history.title} description={m.history.auditNote} />
      <Card className="px-5 py-2 sm:px-6">
        <HistoryList records={records} locale={locale} timeZone={timeZone} />
      </Card>
    </div>
  );
}
