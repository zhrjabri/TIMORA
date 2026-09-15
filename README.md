# TIMORA · تيمورا

> متى فعلتها آخر مرة، ومتى أفعلها مجددًا؟ — When did I last do this, and when should I do it again?

TIMORA is an Arabic-first web app for irregular recurring responsibilities: water filters, AC service, car oil, toothbrushes, plants, pets, document renewals, lent items. Tap **تم الآن / Done now**, and the next due date is calculated for you. Each item can carry a printable QR label that opens it directly.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, Server Components, Server Actions, `proxy.ts`), React 19, TypeScript 5.9 strict |
| UI | Tailwind CSS 4 with semantic tokens, Radix primitives (dialogs), Lucide icons, Sonner toasts |
| Data & auth | Supabase Postgres + Supabase Auth, Row-Level Security on every table |
| Validation | Zod 4 (shared by browser and server), React Hook Form |
| Files | `qrcode` (PNG/SVG), `ics` (calendar events, re-folded to RFC 5545 octet limits) |
| Tests | Vitest (unit + PGlite database/RLS), Playwright + axe-core (end-to-end, accessibility) |

No service-role key, no background jobs, no email reminders, no analytics — see *Scope* below.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npm run dev
```

### Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted. **Never** a secret/service-role key — the app refuses to start with one. |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin used in QR codes, calendar links and auth email redirects |

All values are validated at runtime (`src/lib/env.ts`).

### Supabase project setup

1. Apply the migration in `supabase/migrations/` (Supabase CLI `supabase db push`, or paste it into the SQL editor).
2. **Authentication → URL configuration**: set *Site URL* to `NEXT_PUBLIC_SITE_URL` and add `${NEXT_PUBLIC_SITE_URL}/auth/confirm` to *Redirect URLs*.
3. **Authentication → Providers → Email**: keep email/password enabled. With *Confirm email* on, sign-up shows “check your email”; the link lands on `/auth/confirm`.
4. Optional (recommended) email templates using the token-hash flow:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
   The default PKCE `code` links also work.
5. Review Auth rate limits (Authentication → Rate limits). Auth requests are made from the browser so limits apply per visitor.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript; raw HTML injection is a lint error) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests and database tests |
| `npm run test:db` | Migrations + RLS in PGlite with two users |
| `npm run test:e2e` | Production build + Playwright against the local Supabase stand-in |
| `npm run icons` | Regenerates SVG/PNG/ICO brand assets from `src/lib/brand/marks.ts` |
| `npm run check` | lint → typecheck → tests → build |

First E2E run: `npx playwright install chromium`.

## Testing without a hosted Supabase project

- **Database tests** (`tests/db`) load `tests/support/supabase-bootstrap.sql` (roles, `auth.users`, `auth.uid()`, Supabase’s default grants) and then the real migration into PGlite. They prove cross-user isolation, anon lockout, column-level write protection, append-only history and every constraint/trigger.
- **E2E tests** run against `tests/support/fake-supabase.mjs`, a small stand-in for the Auth and REST HTTP APIs backed by PGlite with the same migration, so RLS is enforced on every request. It is test infrastructure only and never deployed. **Before launch, run the E2E suite once against a real Supabase project.**

## Real-Supabase isolation test (opt-in, creates real accounts)

`tests/e2e-real/real-isolation.spec.ts` signs up **two real accounts** in the Supabase project configured in `.env.local` and proves they cannot see or change each other's data. It is never run by `npm test`, `npm run test:e2e` or `npm run check`; it runs only with its own config:

1. In Supabase, temporarily turn **Confirm email** OFF. The test's first step checks `GET /auth/v1/settings` and stops unless `mailer_autoconfirm` is `true`.
2. `npm run build`, then `npx next start -H 127.0.0.1 -p 3000`.
3. `npx playwright test --config playwright.real.config.ts`
4. Turn **Confirm email** back ON.
5. Delete the created users under Authentication → Users. The run prints each account and item it created. Every user's rows are removed with the user (`on delete cascade`). If a run was interrupted before it printed that list, look for users named `timora-e2e-*@example.com`.

It uses only the public URL and publishable key. The passwords are random for each run and never printed. Traces and videos are off.

## Architecture notes

```
src/
  app/                 routes (public, (auth), (app) protected), route handlers, server actions
  components/          ui primitives, items, auth, settings, brand
  i18n/                config, typed dictionaries (ar is the source of truth), plural/date formatting
  lib/
    domain/            pure date, recurrence and status logic (fully unit-tested)
    items/             view model, presentation strings, browse (search/filter/sort), queries
    supabase/          server and browser clients
    validation/        Zod schemas shared by client and server
supabase/migrations/   schema, RLS, grants, triggers, view
tests/                 unit, db (PGlite), e2e (Playwright), support
```

### Scheduling rules

- **Dates vs instants.** Schedules use calendar dates (`completed_on`, `due_date`); audit timestamps (`recorded_at`, `undone_at`) are UTC instants shown in the user’s time zone. A due date never shifts when the user travels.
- **Next due** = last active completion date + interval. Each completion becomes the new anchor.
- **Month-end rule:** keep the day of month if it exists, otherwise clamp to the month’s last day. Jan 31 + 1 month → Feb 28 (Feb 29 in leap years); Mar 31 + 1 month → Apr 30; Feb 29 + 1 year → Feb 28. Because the anchor always moves to the actual completion, clamping never accumulates drift.
- **One-time dates** are due until a completion is recorded after the date was set (a historical “last done” entered at creation does not resolve them). Changing the date re-opens it.
- **Statuses are derived, never stored:** archived → no schedule → overdue → due today → due soon → good.
- **Due-soon default:** interval ≤ 7 days → 1 day before; ≤ 31 days → 3; ≤ 183 days → 7; longer or one-time → 14. Editable per item (0–365).
- **Undo** marks a record with `undone_at`; records are never deleted by users. Double taps within 5 seconds are rejected by the database.

### Security model

- RLS on `profiles`, `categories`, `items`, `completion_records`; every policy is scoped to `auth.uid()`; `anon` has no table access.
- Column-level grants: users can’t set `user_id`, `qr_token`, `schedule_set_at`, system category keys, or modify completion history except the undo marker.
- Composite foreign keys ensure an item’s category and a completion’s item belong to the same user.
- Every Server Action re-verifies the session (`getClaims`), validates with Zod, applies a per-user burst limit, and maps database errors to safe codes. Next.js checks the Origin of Server Action requests (CSRF).
- QR tokens are 64 hex characters (244 random bits), resolved only within the scanning user’s RLS scope; another user’s token behaves exactly like an unknown one. Tokens can be rotated.
- Nonce-based CSP (`script-src 'nonce-…' 'strict-dynamic'`), `frame-ancestors 'none'`, `nosniff`, strict referrer policy, HSTS on HTTPS. No `dangerouslySetInnerHTML` anywhere (lint-enforced); QR codes render as SVG elements.
- Post-login redirects accept only allow-listed internal paths.
- The in-memory rate limiter is per server instance (best effort). Supabase Auth limits and database guards are the durable protections.

### Internationalisation

- Arabic (RTL) is the default; English (LTR) is available from every page. The choice is saved in a cookie and in the profile.
- Dictionaries are typed; `en` must match `ar` structurally (enforced by TypeScript and a unit test). Arabic uses all six CLDR plural forms.
- Dates use the Gregorian calendar with Latin digits via `INTL_TAG` in `src/i18n/config.ts`. Hijri support later means changing the `ca` extension there, not component code.
- Fonts: IBM Plex Sans Arabic + IBM Plex Sans for interface text, Alexandria for brand headings. Arabic text is never letter-spaced.

## Brand

The approved logo system is **B + D** from the Interval Ruler concept: evenly spaced history ticks and a gold next-due diamond, drawn in Arabic reading order and never mirrored. Geometry lives in `src/lib/brand/marks.ts`; generated assets are in `public/brand`, `public/icons` and `src/app/{icon.svg,favicon.ico,apple-icon.png}`. Design tokens are documented in `design-system/timora/MASTER.md`.

## Scope

In the MVP: email auth, items, simple recurrence, derived statuses, dashboard, history with undo, categories, QR labels, `.ics` export, PWA shell, light/dark/system themes, Arabic/English.

Deliberately excluded: reminder emails, SMS/WhatsApp/Telegram/push notifications, AI or image recognition, background jobs/cron/queues/Redis, native apps, payments, teams/organisations, social or public pages, NFC, location, complex analytics, complex recurrence, and direct calendar API sync.

TIMORA records intervals the user defines; it does not give medical or mechanical advice.
