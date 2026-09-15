"use client";

import { Toaster } from "sonner";
import { useI18n } from "@/i18n/provider";

export function AppToaster() {
  const { dir } = useI18n();
  return (
    <Toaster
      dir={dir}
      position="top-center"
      offset={16}
      mobileOffset={{ top: 12, left: 12, right: 12 }}
      duration={5000}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "rounded-card! border! border-line! bg-surface! text-ink! shadow-float! font-[inherit]! gap-3! px-4! py-3.5!",
          title: "font-medium! text-[0.95rem]!",
          description: "text-ink-2! text-sm!",
          actionButton: "bg-primary! text-primary-ink! rounded-lg! font-medium! px-3! h-9! text-sm!",
          icon: "text-good!",
        },
      }}
    />
  );
}
