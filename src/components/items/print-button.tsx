"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label }: { label: string }) {
  return (
    <Button size="lg" className="self-start" icon={<Printer className="size-5" aria-hidden />} onClick={() => window.print()}>
      {label}
    </Button>
  );
}
