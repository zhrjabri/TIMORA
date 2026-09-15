const ALLOWED_PREFIXES = ["/dashboard", "/items", "/categories", "/settings", "/q/", "/reset-password"];

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Accepts only same-origin application paths as post-auth destinations, preventing
 * open redirects such as `//evil.com`, `/\evil.com`, `https://…` or `javascript:`.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Some browsers strip control characters before resolving a URL, which could turn "/\t/evil" into "//evil".
  if (hasControlCharacters(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, "https://timora.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://timora.invalid") return fallback;
  const path = url.pathname;
  if (!ALLOWED_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix))) return fallback;
  return `${path}${url.search}`;
}
