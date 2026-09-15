"use client";

/** Last-resort boundary when the root layout itself fails; intentionally dependency-free and bilingual. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: "system-ui, Tahoma, sans-serif", background: "#F7F5F0", color: "#111111" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: 22 }}>تعذّر تحميل تيمورا</h1>
            <p lang="en" dir="ltr" style={{ color: "#5E5B55" }}>
              TIMORA couldn&apos;t load.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#111111", color: "#F7F5F0", fontSize: 16, cursor: "pointer" }}
            >
              إعادة المحاولة · Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
