import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { LegalPage } from "@/components/app/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { m } = await getI18n();
  return { title: m.legal.privacyTitle };
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}
