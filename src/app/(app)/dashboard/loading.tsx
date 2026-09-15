import { getI18n } from "@/i18n/server";
import { PageSkeleton } from "@/components/ui/skeletons";

export default async function Loading() {
  const { m } = await getI18n();
  return <PageSkeleton label={m.common.loading} />;
}
