/**
 * TIMORA brand geometry — single source of truth for the approved B + D logo system.
 * Drawn on a 48-unit grid. Direction is fixed (Arabic flow: past ticks on the right,
 * next-due diamond on the left) and must never be mirrored for LTR interfaces.
 */

export const BRAND_COLORS = {
  black: "#111111",
  ivory: "#F7F5F0",
  gold: "#C8A96B",
  gray: "#8C8C8C",
} as const;

export type MarkGeometry = {
  /** Stroked paths drawn in the primary ink. */
  strokes: string;
  strokeWidth: number;
  /** The next-due diamond, filled with the accent. */
  diamond: string;
};

/** Variant B — primary full mark: baseline, three evenly spaced history ticks, next-due marker. */
export const MARK_PRIMARY: MarkGeometry = {
  strokes: "M6 35H42M38 35v-8M30 35v-8M22 35v-8M11 35v-5",
  strokeWidth: 3,
  diamond: "M11 11l6 7-6 7-6-7z",
};

/** Variant D — compact mark for app icon, favicon, mobile header and QR labels. */
export const MARK_COMPACT: MarkGeometry = {
  strokes: "M7 36H42M38 36v-8M28 36v-8M13 36v-4",
  strokeWidth: 4,
  diamond: "M13 11l7.5 7.5L13 26l-7.5-7.5z",
};
