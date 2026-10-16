# Together — "Atlas & Journal" design direction

Chosen 2026-10-16 (see `plan.md` for the audit and the three directions).

## Idea
The logo is two routes that meet at a brass point and continue as one.
That is the whole brand story — *separate lives converge into one trip* —
and it drives every visual decision:

- **Atlas** (first impressions: `/welcome`, invite preview, trip launch):
  a dark night-sky scene with a real Earth. Routes from where people live
  draw across the globe and meet at one brass point — the destination.
- **Journal** (the product): light, calm, sunlight-readable pages. The same
  route line becomes the itinerary spine, progress and connectors; brass
  marks only the "meeting" moments (what's next, the primary action, AI).

One memorable thing per surface. Everything around it stays quiet.

## Tokens
| Name | Hex | Role |
|---|---|---|
| Night | `#070C16` | Atlas ground (blue-black, never neutral black) |
| Ink | `#0F1B2D` | text, primary actions |
| Chart | `#F1F3EF` | Journal ground — pale grey-green of nautical chart paper (deliberately *not* cream) |
| Paper | `#FFFFFF` | raised surfaces |
| Brass | `#B08A55` | convergence accent: meeting node, primary CTA, "next", AI |
| Sea | `#2F6B66` | live/map/now — functional, not decorative |
| Clay | `#A4523A` | destructive and errors only |

## Type
- **Display:** Frank Ruhl Libre (OFL) — a serif drawn for Hebrew first, so
  Hebrew headlines look native, not Latin-with-fallback. Weights 400–500,
  tight leading (1.05–1.1), used large and sparingly.
- **Text/UI:** IBM Plex Sans Hebrew 400/500/600.
- **Wordmark only:** Jost (the TOGETHER logotype).
- Scale (px): 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 64 · 88. Nothing in-app
  below 12px. Sentence case everywhere; no tracked all-caps eyebrows.

## Rules
- Brass appears only where things converge. If a screen has three brass
  elements, two are wrong.
- Numbers/sequence markers only for real sequences (how it works, itinerary).
- Motion: one orchestrated moment per surface (Atlas: the routes converging
  on load; Journal: sheets/expansions that answer a tap). No fade-up on every
  section. `prefers-reduced-motion` gets the finished state instantly.
- Photography: self-hosted & licensed (Unsplash/Pexels) or the trip's own
  Google Places photos; fallbacks use route-line art, not flat icon tiles.
- Mobile first: 390px is the design width; desktop gets real layouts, not a
  stretched phone column.

## Credits
Earth imagery: NASA Visible Earth — Blue Marble Next Generation (day) and
Black Marble 2016 (night lights). Public domain; credit "Imagery: NASA".
