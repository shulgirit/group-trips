import { readFileSync } from "node:fs";
import { internal } from "@together/backend/api";
import { adminQuery, args, convexAdmin } from "./convex";
import type { Snapshot } from "./snapshot";
import { transform } from "./transform";

/**
 * Step 4 — compares what the transform planned with what Convex holds, per
 * trip. Exits non-zero on any mismatch; prints counts only (no personal data).
 *
 *   CONVEX_URL=… CONVEX_DEPLOY_KEY=… pnpm --filter @together/migrate verify -- --snapshot …
 */

interface Counts {
  users: number;
  accounts: number;
  trips: { firebaseId: string | null; [table: string]: number | string | null }[];
}

async function main() {
  const flags = args();
  const snapshotPath = flags.get("snapshot");
  if (!snapshotPath) throw new Error("--snapshot <path> is required");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;
  const ownerEmail = flags.get("legacy-owner-email")?.toLowerCase();
  const legacyOwnerUid = ownerEmail ? snapshot.authUsers.find((u) => u.email?.toLowerCase() === ownerEmail)?.uid : undefined;
  const plan = transform(snapshot, { siteUrl: flags.get("site-url") ?? "https://together.app", legacyOwnerUid });

  const actual: Counts = await adminQuery(convexAdmin(), internal.migration.counts, {});
  const problems: string[] = [];
  const expectEq = (label: string, want: number, got: number | undefined) => {
    if (want !== got) problems.push(`${label}: planned ${want}, found ${got ?? 0}`);
  };

  expectEq("users", plan.users.length, actual.users);
  expectEq("accounts", plan.users.filter((u) => u.accounts.length && u.email).length, actual.accounts);
  for (const trip of plan.trips) {
    const row = actual.trips.find((t) => t.firebaseId === trip.firebaseId);
    if (!row) {
      problems.push(`trip ${trip.firebaseId}: missing`);
      continue;
    }
    const count = <T extends { tripFid: string }>(rows: T[]) => rows.filter((r) => r.tripFid === trip.firebaseId).length;
    expectEq(`${trip.firebaseId} memberships`, count(plan.memberships), Number(row.memberships));
    expectEq(`${trip.firebaseId} families`, count(plan.families), Number(row.families));
    expectEq(`${trip.firebaseId} places`, count(plan.places), Number(row.places));
    expectEq(`${trip.firebaseId} events`, count(plan.events), Number(row.events));
    expectEq(`${trip.firebaseId} expenses`, count(plan.expenses), Number(row.expenses));
    expectEq(`${trip.firebaseId} polls`, count(plan.polls), Number(row.polls));
    expectEq(`${trip.firebaseId} chats`, count(plan.chats), Number(row.chats));
    expectEq(`${trip.firebaseId} invites`, count(plan.invites), Number(row.invites));
  }
  console.log(JSON.stringify(actual, null, 2));
  if (problems.length) {
    console.error(`✗ ${problems.length} mismatches\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(`✓ ${plan.trips.length} trips verified`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
