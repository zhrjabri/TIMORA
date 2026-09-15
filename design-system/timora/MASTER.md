# TIMORA Design System — Master

Source of truth for visual decisions. Tokens are implemented in `src/app/globals.css`; contrast pairs are verified by `tests/unit/contrast.test.ts`.

Guided by the UI/UX Pro Max skill: *Minimalism & Swiss* style (clean, functional, generous white space), accessibility-first rules (4.5:1 text, 3:1 UI, visible focus, 44 px targets, reduced motion), mobile-first layout, SVG icons only, semantic colour tokens. The skill’s generated palette (blue/green) and Caveat/Quicksand pairing were rejected in favour of the approved brand palette and a readability-first Arabic pairing.

## Personality

Premium, calm, reliable, timeless, minimal, practical, warm. A productivity tool with a refined identity — not a luxury shop.

## Logo system (approved B + D)

| Use | Mark |
| --- | --- |
| Full logo, desktop header, landing, 404 | B — baseline, three evenly spaced history ticks, next-due diamond (stroke 3) |
| App icon, favicon, mobile header, QR labels, small sizes | D — bold compact ruler: two ticks, larger diamond (stroke 4) |

- Direction is fixed (Arabic flow: history on the right, next due on the left) and **never mirrored**, including in English.
- Ink uses `currentColor`; the diamond is Champagne Gold. On Ivory the ink carries recognition; gold is secondary (2.06:1).
- App icons and favicons always sit on a Deep Black tile (gold reaches 8.4:1).
- Monochrome versions set the diamond to the ink colour.

## Palette

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--bg` | #F7F5F0 Ivory | #111111 | Page |
| `--surface` | #FDFCF9 | #1A1A19 | Cards, inputs |
| `--surface-muted` | #EFECE5 | #242422 | Icon tiles, selected states |
| `--ink` | #111111 | #F7F5F0 | Primary text |
| `--ink-2` | #5E5B55 | #B3AFA6 | Secondary text (replaces Soft Gray for text) |
| `--ink-3` | #6B6862 | #9C988F | Placeholders, tertiary |
| `--line` | #E4DFD4 | #2E2D2A | Dividers, card borders (decorative) |
| `--line-strong` | #8C8C8C Soft Gray | #6E6B66 | Input borders (≥ 3:1) |
| `--accent` | #C8A96B Gold | #C8A96B | Diamond, active nav rule, underline accents — never text on Ivory |
| `--accent-ink` | #7D6431 | #C8A96B | Gold-toned small text where needed |
| `--primary` / `--primary-ink` | #111111 / #F7F5F0 | #C8A96B / #111111 | Primary buttons (Done now) |
| `--focus` | #111111 | #C8A96B | Focus rings |

### Status (always icon + label, never colour alone)

| Status | Light fg / bg | Dark fg / bg | Icon |
| --- | --- | --- | --- |
| Overdue | #9B2C1F / #F7DEDA | #F29A8C / #3A1F1B | CircleAlert |
| Due today | #8A4210 / #F7E1CE | #F0A872 / #34231A | Clock |
| Due soon | #7A5712 / #F4EAD2 | #E2C37F / #2E2716 | Hourglass |
| Good | #2F6B45 / #E3EEE5 | #8FCB9F / #1C2A20 | CircleCheck |
| No schedule / Archived | #5E5B55 / #EAE7E0 | #B3AFA6 / #262523 | CalendarOff / Archive |

## Typography

| Role | Arabic | Latin |
| --- | --- | --- |
| Interface | IBM Plex Sans Arabic 400/500/600/700 | IBM Plex Sans 400/500/600 |
| Brand, headings | Alexandria 500/600 | Alexandria 500/600 |

- Base 16 px; Arabic line-height 1.6, English 1.5. Scale: 12 · 14 · 16 · 18 · 22 · 28 · 36–48.
- Never letter-space Arabic. Latin wordmark tracking +24%.
- Latin digits in both languages; `tabular-nums` for counters.

## Layout & components

- Mobile first; content max width 64 rem (app) / 72 rem (landing); 16 px gutters on mobile.
- Mobile: sticky top bar with compact lockup + language switch; bottom navigation with 4 destinations and a central Add action.
- Desktop: top navigation with a 2 px gold rule under the active item; no sidebar.
- Radius: controls 12 px, cards 16 px. Shadows only for raised primary actions and floating layers.
- Touch targets ≥ 44 px. Inputs 48 px high with visible labels, hints and inline errors.
- Destructive actions (delete item/category, rotate QR code) use a confirmation dialog with focus on Cancel; everything else confirms with a toast, with Undo where reversible.

## Motion

- 150–220 ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Press scale 0.98. Check-mark draw on Done now. Skeleton shimmer while loading.
- `prefers-reduced-motion: reduce` disables animation and transitions.

## Avoid

Glassmorphism, decorative charts, gold body text, gradients, emoji icons, dense forms, generic admin-template look, mirroring the logo.
