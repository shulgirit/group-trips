# Together

Trip planning for groups: shared schedule, places and map, polls, bookings and documents, expenses with settle-up, an AI trip
planner and travel guide, and opt-in live location. Mobile app (Expo), Convex backend, Next.js landing site.

```bash
pnpm install
pnpm typecheck && pnpm test      # all workspaces via Turborepo
pnpm --filter @together/web dev  # landing site on http://localhost:3000
pnpm --filter @together/mobile start
```

See `CLAUDE.md` for the repo map, services, deployment and conventions, and `docs/` for store texts, OTA and design notes.
