# Together — creative direction & redesign plan

## Context
Omer's brief: transform Together into a world-class, memorable consumer travel
product (Awwwards-level landing + premium, effortless in-app UX), with ZERO
paid tools, verified licenses, no lost features, no production deploy without
his OK, and a real screenshot-driven iteration loop. Phase 1 (audit) is done;
this plan records findings, three directions, the recommendation, and how the
first visual proof will be built. Work stops after the proof for his review.

## Phase 1 findings (audit, read-only)
**Product (40 features — none may be dropped):** auth (Google/Apple/guest/kid/
legacy gate), trips hub, 5-step creator wizard (multi-stop, families, booking
import, AI persona, launch + invites), invite/join, trip home, itinerary,
Google map + live location, places (import/enrich/favorites), AI chat with
tool actions & image input, polls, multi-currency expenses + settlement,
documents, roles/admin/danger zone, push reminders, he/en RTL, tour, legal.

**Live welcome page (screenshots taken 390/1440, he/en):** navy band, logo,
light headline, Google button, then four identical cards. No imagery, no
product shown, no motion, desktop = 448px column, sign-in before value.

**Visual system:** tidy tokens but timid: no display face (`--font-display`
= Plex), no type scale (mostly text-sm, 9–11px one-offs), zero motion
(no keyframes; sheets pop in), 3 photos in /public, flat white-card-on-ivory
everywhere, brand motif (converging routes + brass node) unused, 7 radius
values, no dark mode, desktop is a phone column, weak focus/contrast spots.

**Top UX issues:** invites buried in Settings; Polls/Expenses/Documents
hidden in More while Places+Map both take nav slots; map opens on an empty
"scheduled" filter; Waze/Maps fallback can search "…Sicily" on any trip;
AI replies non-streamed behind one "thinking…" with no action receipts;
overloaded forms (wizard ~25 inputs, new-place 3 methods + 13 fields);
settings one long page; tour modal collides with identity prompt; guests
blocked without a clear upgrade path; tiny 10–11px labels.

**Stack/licenses (verified 2026-10-16):** frontend-design plugin (Apache-2.0,
no keys) · UI/UX Pro Max skill (MIT, local, already present as `uiux`) ·
Motion 14 (MIT, LazyMotion ≈ 5 KB + 24 KB async) · COBE 2 (MIT, ≈ 6 KB) ·
three.js 0.186 (MIT, ≈ 130–160 KB gz tree-shaken) · GSAP 3.15 (free "no
charge" proprietary license — allowed, use only if needed) · shadcn/ui CLI 4
(MIT) · Magic UI free (MIT) · React Bits (MIT + Commons Clause — OK inside
the app) · **Aceternity rejected (free-tier license not stated)** · Motion+
and Magic UI Pro excluded (paid) · Lenis skipped (bad in mobile/webview) ·
imagery: Unsplash/Pexels (self-host), Natural Earth (public domain), NASA
textures (credit NASA) · fonts (OFL, he+latin): Frank Ruhl Libre, Bellefair,
Rubik, Assistant, Secular One, IBM Plex Sans Hebrew.

## Three directions
| | A · The World Is Waiting | B · The Art of Traveling Together | C · Your Adventure, Alive |
|---|---|---|---|
| Mood | dark atmospheric atlas, cinematic | warm editorial travel magazine | bold, playful startup energy |
| Signature | real 3D Earth, glowing destinations, route arcs meeting at a brass point | full-bleed photography, serif display, journal timelines | animated routes, bright accents, expressive cards |
| Fit for families/groups | strong first impression | strongest in-app (sunlight-readable, calm) | fun, but risks feeling generic/young |
| Mobile & perf | heavy if used in-app | light | medium |
| Originality | high (if globe is custom) | high with real typography | medium (common look) |

**Recommendation — hybrid "Atlas & Journal":** Direction A *only* for first
impressions (welcome, join preview, launch moment), Direction B for the whole
product. The brand's two-routes-meeting mark is the bridge: on the globe,
arcs from each traveler's home converge on the destination's brass node; in
the app the same route line becomes the itinerary timeline, progress, and
transitions. In-app stays light ivory (outdoor sunlight readability), with a
dark mode later. This matches Omer's preference and avoids a dark, heavy app.

## Decisions (Omer, 2026-10-16)
- Direction: **Hybrid "Atlas & Journal"** (as recommended).
- Headlines: **Frank Ruhl Libre** (serif, OFL, he+latin) for display only;
  IBM Plex Sans Hebrew for all text/UI. Update CLAUDE.md "Heebo only" note.
- Globe: **custom realistic Earth with three.js** (vanilla three, not R3F —
  avoids R3F's React <19.4 peer cap): NASA Blue Marble day texture (+ city
  lights for the night side), atmosphere rim shader, illuminated destination
  points, animated arcs converging on a brass node. Textures self-hosted,
  compressed (≤ ~600 KB total, 2K on mobile), credited "Imagery: NASA".

## Design system (to implement after approval)
- **Color:** keep ink navy / ivory / brass; add night-sky surface scale for
  the landing, sea-glass for "map/now", clay for alerts; semantic tokens
  (bg, surface-1/2, line, fg, muted, primary, accent, success, warning,
  danger, ai, map, selected); rename misleading legacy names via aliases.
- **Type:** display face (pending choice below) + IBM Plex Sans Hebrew text;
  fluid type scale (12/14/16/18/22/28/36/48/64), min 12px in-app.
- **Layout:** spacing + radius tokens (8 cards / 14 sheets / full chips),
  3 elevation levels, real desktop layouts (two-pane trip views ≥1024px).
- **Motion:** one system — Motion (LazyMotion). Tokens: 160ms micro, 240ms
  sheet, 420ms page, 900ms+ story; spring for sheets; reduced-motion honored.
- **Imagery:** self-hosted, licensed destination photography (AVIF/WebP via
  next/image) + Google Places photos inside trips; branded fallbacks
  (route-line art) instead of flat icon tiles.

## Phase 3 — first visual proof (after direction approval)
Branch `redesign` (Vercel preview; `main` untouched).
1. Install frontend-design plugin; load it + `uiux` skill before designing.
2. Save docs: `docs/design/audit.md`, `docs/design/direction.md`,
   `docs/design/stack.md` (licenses) — survive context compaction.
3. **Landing `/welcome`** (`src/app/welcome/page.tsx` → `src/components/landing/*`):
   - Hero: custom globe (`src/components/landing/Globe.tsx`, client-only via
     `next/dynamic`, loaded after first paint, DPR ≤ 2, paused off-screen,
     destroyed on unmount, poster image fallback for reduced-motion/no-WebGL).
     Headline + clear product line + primary CTA visible without the globe.
   - Story sections: One trip, everyone connected · Beautifully organized
     (real-looking itinerary built from our own components with sample data,
     labeled as example) · Your AI travel companion (scripted demo, clearly
     a sample) · Everything in its place (bookings → itinerary transition) ·
     Better together (expenses/polls) · Final CTA + footer.
   - Sign-in moves to the CTA/hero action; legacy trip-code link to footer.
4. **One in-app screen — Trip home** (`src/app/(app)/page.tsx`): editorial
   hero with real photo or route-art fallback, "what's next" card answering
   when/where/how-to-get-there, today as a route-line timeline, quick access
   row (itinerary, map, tickets, expenses, invite), invite nudge for admins.
   Keep countdown `dir="ltr"`, days leftmost. Same data/hooks as today.
5. New strings as i18n keys in `src/i18n/messages/{he,en}/*`.

## Verification (Phase 4 loop, per screen)
- `npx tsc --noEmit`, `npm run build`, lint ≤ baseline.
- Playwright (scratchpad, local Chrome): 390×844 and 1440×900, he + en,
  reduced-motion, WebGL-off fallback; trip home against the Firebase
  emulator with seeded sample data (no production data). Critique → fix →
  re-shoot until it meets the bar; side-by-side with old screenshots.
- Lighthouse mobile on preview `/welcome` (target perf ≥ 85, CLS < 0.05);
  confirm zero globe/three.js code in trip-route bundles.
- Report: what changed, tools used, tradeoffs, what was tested, known issues.
