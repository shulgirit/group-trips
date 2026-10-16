import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { firebase } from "./firebase";
import type { AuthUserSnap, Data, DocSnap, Snapshot, TripSnap } from "./snapshot";

/**
 * Step 1 — read-only export of Firebase Auth + Firestore into
 * .migrate/<timestamp>/snapshot.json (contains personal data: gitignored,
 * file mode 600). Prints counts only.
 *
 *   pnpm --filter @together/migrate export
 */

/** Firestore values → JSON (Timestamps become epoch ms). */
function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toMillis();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Data).map(([key, inner]) => [key, plain(inner)]));
  }
  return value;
}

async function exportAuth(): Promise<AuthUserSnap[]> {
  const { auth } = firebase();
  const users: AuthUserSnap[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        disabled: user.disabled,
        createdAt: Date.parse(user.metadata.creationTime) || 0,
        providers: user.providerData.map((provider) => ({ providerId: provider.providerId, uid: provider.uid, email: provider.email })),
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function exportCollection(path: string): Promise<DocSnap[]> {
  const snapshot = await firebase().db.collection(path).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: plain(doc.data()) as Data }));
}

async function exportTrips(): Promise<TripSnap[]> {
  const { db } = firebase();
  const trips = await db.collection("trips").get();
  const out: TripSnap[] = [];
  for (const trip of trips.docs) {
    const collections: Record<string, DocSnap[]> = {};
    for (const sub of await trip.ref.listCollections()) {
      collections[sub.id] = await exportCollection(sub.path);
    }
    out.push({ id: trip.id, data: plain(trip.data()) as Data, collections });
  }
  return out;
}

async function main() {
  const startedAt = Date.now();
  const snapshot: Snapshot = {
    exportedAt: startedAt,
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? "group-trips-2f753",
    authUsers: await exportAuth(),
    users: await exportCollection("users"),
    invites: await exportCollection("invites"),
    trips: await exportTrips(),
  };
  const dir = join(process.env.MIGRATE_DIR ?? ".migrate", new Date(startedAt).toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "snapshot.json");
  writeFileSync(file, JSON.stringify(snapshot), { mode: 0o600 });
  console.log(`snapshot → ${file}`);
  console.log(
    JSON.stringify(
      {
        authUsers: snapshot.authUsers.length,
        users: snapshot.users.length,
        invites: snapshot.invites.length,
        trips: snapshot.trips.map((trip) => ({
          id: trip.id,
          ...Object.fromEntries(Object.entries(trip.collections).map(([name, docs]) => [name, docs.length])),
        })),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
