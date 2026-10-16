# Redesign brief for page work (read before touching a page)

Direction: "Atlas & Journal" — see docs/design/direction.md. In-app pages are **Journal**:
light, calm, sunlight-readable, editorial. Reference implementations to match:
`src/app/(app)/page.tsx` (trip home) and `src/app/(app)/calendar/page.tsx` (timeline).

## Rules
- Tokens only (Tailwind v4 theme in src/app/globals.css): grounds `bg-cream-50` (chart paper),
  surfaces `bg-white`, text `ink-*`, primary `sea-900`/`night-950`, accent `brass-*` ONLY for
  "meeting" moments (primary action, now/next, the guide), functional `route-*` (live/map/done),
  `terra-*` only for errors/destructive. No new hex colors.
- Headings: `font-display` (serif; Hebrew automatically uses Open Sans 600). Text: default sans.
- Sentence case. No ALL-CAPS tracked labels, no em dashes (—) in new copy, no emoji.
- Nothing below 12px in-app (`text-xs` minimum). Touch targets ≥ 44px.
- Cards: `rounded-2xl bg-white` with soft shadow `shadow-[0_1px_2px_rgb(15_27_45/0.05),0_10px_28px_-22px_rgb(15_27_45/0.45)]`
  or hairline `border border-cream-200`. Avoid identical-card grids; vary hierarchy.
- User-written text (titles, names, notes): wrap in `<bdi>` inline, or `dir="auto"` on a truncating element.
- RTL/LTR: logical classes only (ms-/me-/ps-/pe-/start-/end-), `rtl:rotate-180` on directional chevrons.
- Mobile first (390px); desktop ≥1024 has a side rail and `max-w-3xl` column — use grids where useful.
- Icons: lucide-react with `strokeWidth={STROKE}` from `@/components/ui/Icon`.
- i18n: every new/changed string via `useT()` keys. Add keys to ALL FOUR locales:
  `src/i18n/messages/{he,en,ar,es}/<namespace>.ts` (he = source; en typed `typeof he`;
  ar/es typed `PartialMessages[...]`). Use the Edit tool for message files (other people edit
  other parts of them at the same time) — never rewrite a whole shared file.
- Keep ALL behavior, data writes, API calls and features. Visual/UX restructuring only, unless
  the task says otherwise. Do not touch files outside your assignment.

## Verify (mandatory)
- `npx tsc --noEmit -p .` clean; `npx eslint <your files>` — no NEW errors (some files have
  pre-existing react-hooks errors; don't add more).
- Screenshots: dev server already running at http://localhost:3100 against the Firebase
  emulator (do NOT start/stop servers). Harness scripts (playwright-core, Chrome):
  /private/tmp/claude-501/-Users-omertal-Desktop-Wiply-shulgirit-group-trips/ffb3394e-e689-4857-acf5-1bdf16f44a70/scratchpad/audit/
  `sweep.mjs` (signs in a fake user, seeds a trip with places/events/expenses/poll, screenshots
  routes; env LANG_CODE=he|en|ar|es, ROUTES="name:/path,...", SIZES=390x844,1440x900, FULL=1),
  `product.mjs` (trips hub, /new, /j/<code>). Copy one into your own scratch folder and adapt.
  Check he (RTL) and en at 390px, plus 1440px once. Critique and iterate until it meets the bar.
- Never run git commands. Never touch production data.
