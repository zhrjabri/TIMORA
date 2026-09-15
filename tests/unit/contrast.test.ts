import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** WCAG 2.x relative luminance contrast ratio. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function readBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Selector not found: ${selector}`);
  const open = start + selector.length - 1;
  const close = css.indexOf("}", open);
  const tokens: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[m[1]!] = m[2]!;
  }
  return tokens;
}

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const light = readBlock(css, ":root {");
const dark = readBlock(css, ':root[data-theme="dark"] {');

const TEXT_PAIRS: Array<[string, string]> = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "surface-muted"],
  ["ink-2", "bg"], ["ink-2", "surface"], ["ink-2", "surface-muted"],
  ["ink-3", "bg"], ["ink-3", "surface"],
  ["accent-ink", "bg"], ["accent-ink", "surface"],
  ["primary-ink", "primary"],
  ["good", "good-bg"], ["good", "surface"],
  ["soon", "soon-bg"], ["soon", "surface"],
  ["today", "today-bg"], ["today", "surface"],
  ["overdue", "overdue-bg"], ["overdue", "surface"],
  ["neutral", "neutral-bg"], ["neutral", "surface"],
];

const UI_PAIRS: Array<[string, string]> = [
  ["line-strong", "bg"], ["line-strong", "surface"], ["focus", "bg"], ["focus", "surface"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme tokens", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s on %s meets WCAG AA for text (4.5:1)", (fg, bg) => {
    expect(tokens[fg], `missing --${fg}`).toBeDefined();
    expect(tokens[bg], `missing --${bg}`).toBeDefined();
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("%s on %s meets WCAG AA for UI components (3:1)", (fg, bg) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

describe("brand palette facts", () => {
  it("documents why gold is never used as text on ivory", () => {
    expect(contrast("#C8A96B", "#F7F5F0")).toBeLessThan(3);
    expect(contrast("#C8A96B", "#111111")).toBeGreaterThan(7);
  });
});
