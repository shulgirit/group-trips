# סיציליה 2026 🇮🇹

Private travel app for four families traveling together in Sicily.
Hebrew-first, RTL-first, mobile-first, installable as a PWA.

## Stack

- Next.js (App Router) + TypeScript strict + Tailwind CSS v4
- Firebase: Firestore (realtime), Storage, Admin SDK (server)
- OpenAI (trip concierge AI), Firecrawl (place import), Google Maps Platform
- Deployed on Vercel

## Development

```bash
npm install
cp .env.example .env.local   # fill in what you have; the app runs without it
npm run dev
```

Without `TRIP_PASSWORD` set, development uses the fallback password `sicilia`.

## Structure

- `src/app/gate` — shared-password access screen (signed HTTP-only cookie)
- `src/proxy.ts` — request gate for every private route
- `src/app/(app)` — the app shell: עכשיו, מקומות, לוח, מפה, עוד
- `src/lib` — trip config, auth, (soon) Firebase + AI clients
- `src/components` — layout, home, and UI building blocks

Secrets live in `.env.local` (never committed). See `.env.example` for the
full list of required keys and how each one is scoped.
