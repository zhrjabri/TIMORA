import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { getIcon } from "@/lib/icons";

/** Renders a stored icon key. Unknown keys fall back to a neutral shape. */
export function AppIcon({ iconKey, ...props }: Omit<LucideProps, "name"> & { iconKey: string | null | undefined }) {
  return createElement(getIcon(iconKey), props);
}
