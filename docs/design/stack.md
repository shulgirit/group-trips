# Design stack & licenses (verified 2026-10-16)

Rule: zero paid tools. Anything Pro/paid/unclear is not used.

| Package / resource | License | Status | Where |
|---|---|---|---|
| three 0.186 | MIT | **used** | landing globe only (dynamic import) |
| motion 14 (`motion/react`) | MIT | **used** | the one motion system (app + landing) |
| Frank Ruhl Libre, IBM Plex Sans Hebrew, Jost, IBM Plex Sans Arabic, Amiri | OFL | **used** | `src/lib/fonts.ts` via next/font (self-hosted; Arabic fonts load only for Arabic glyphs) |
| NASA Blue Marble NG / Black Marble 2016 | public domain (credit NASA) | **used** | `public/globe/*.webp` |
| frontend-design (Claude Code plugin) | Apache-2.0 | used for art direction | — |
| uiux / UI/UX Pro Max skill | MIT | reference | — |
| shadcn/ui | MIT | allowed, adopt per primitive only | — |
| Magic UI (free) | MIT | allowed | — |
| React Bits — Orb | MIT + Commons Clause | **used** (vendored, small local fix noted in header) | `src/components/vendor/react-bits/Orb.tsx` → `src/components/ai/Companion.tsx` (AI guide presence) |
| GSAP 3.15 | free "no charge" proprietary license | allowed; not needed so far | — |
| COBE | MIT | not chosen (look too common) | — |
| react-globe.gl | MIT | not chosen (~509 KB gz) | — |
| @react-three/fiber | MIT | not chosen (peer react <19.4; vanilla three is enough) | — |
| Aceternity UI | free-tier license not published | **rejected** | — |
| Motion+, Magic UI Pro | paid | **excluded** | — |
| Lenis | MIT | skipped (fights native scroll in mobile/webview) | — |

Performance budget: landing adds ≤ ~160 KB gz JS (three, lazy, after first
paint) + ≤ 600 KB textures (2K on phones). Trip routes add no three.js.
