import { PublicFooter, PublicHeader } from "@/components/app/public-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader showAuthLinks={false} />
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-raise sm:p-8">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
