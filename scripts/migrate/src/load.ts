import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { internal } from "@together/backend/api";
import type { Id } from "@together/backend/dataModel";
import type { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { adminMutation, args, convexAdmin } from "./convex";
import { firebase } from "./firebase";
import type { Snapshot } from "./snapshot";
import { type FileSource, type Plan, transform } from "./transform";

/**
 * Steps 2–3 — transform a snapshot and load it into a Convex deployment.
 * Idempotent: files already copied are remembered in files.json next to the
 * snapshot, and every record is an upsert by Firestore id.
 *
 *   CONVEX_URL=… CONVEX_DEPLOY_KEY=… pnpm --filter @together/migrate load -- \
 *     --snapshot .migrate/<ts>/snapshot.json --legacy-owner-email omer@… [--dry-run]
 */

type StorageId = Id<"_storage">;

async function readSource(source: FileSource): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (source.kind === "path") {
    const file = firebase().bucket.file(source.path);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [[bytes], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return { bytes, contentType: String(meta.contentType ?? "application/octet-stream") };
  }
  const response = await fetch(source.url);
  if (!response.ok) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

async function copyFile(client: ConvexHttpClient, source: FileSource): Promise<StorageId | null> {
  const file = await readSource(source);
  if (!file) return null;
  const uploadUrl = await adminMutation(client, internal.migration.uploadUrl, {});
  const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.contentType }, body: new Uint8Array(file.bytes) });
  if (!response.ok) throw new Error(`upload failed: ${response.status}`);
  const { storageId } = (await response.json()) as { storageId: StorageId };
  return storageId;
}

const sourceKey = (source: FileSource) => (source.kind === "path" ? `path:${source.path}` : `url:${source.url.split("?")[0]}`);

async function resolveFiles(client: ConvexHttpClient | null, plan: Plan, cacheFile: string) {
  const cache: Record<string, StorageId | null> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
  const sources: FileSource[] = [
    ...plan.documents.map((doc) => doc.source),
    ...plan.chats.flatMap((chat) => chat.messages.flatMap((message) => (message.image ? [message.image] : []))),
    ...plan.trips.flatMap((trip) => (trip.ai.avatar?.kind === "file" ? [trip.ai.avatar.source] : [])),
  ];
  let copied = 0;
  let missing = 0;
  for (const source of sources) {
    const key = sourceKey(source);
    if (key in cache) continue;
    if (!client) continue;
    cache[key] = await copyFile(client, source);
    if (cache[key]) copied++;
    else missing++;
    writeFileSync(cacheFile, JSON.stringify(cache), { mode: 0o600 });
  }
  console.log(`files: ${sources.length} referenced, ${copied} copied now, ${missing} missing at the source`);
  return (source: FileSource) => cache[sourceKey(source)] ?? null;
}

async function inBatches<F extends FunctionReference<"mutation", "internal", { records: unknown[] }>>(
  client: ConvexHttpClient,
  fn: F,
  records: F["_args"]["records"],
  size: number,
  label: string
) {
  for (let i = 0; i < records.length; i += size) {
    await adminMutation(client, fn, { records: records.slice(i, i + size) } as F["_args"]);
  }
  console.log(`${label}: ${records.length}`);
}

async function main() {
  const flags = args();
  const snapshotPath = flags.get("snapshot");
  if (!snapshotPath) throw new Error("--snapshot <path> is required");
  const dryRun = flags.has("dry-run");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as Snapshot;

  const ownerEmail = flags.get("legacy-owner-email")?.toLowerCase();
  const legacyOwnerUid = ownerEmail ? snapshot.authUsers.find((user) => user.email?.toLowerCase() === ownerEmail)?.uid : undefined;
  if (ownerEmail && !legacyOwnerUid) throw new Error("--legacy-owner-email matches no Firebase user");

  const plan = transform(snapshot, { siteUrl: flags.get("site-url") ?? "https://together.app", legacyOwnerUid });
  const byKind = plan.warnings.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.kind]: (acc[w.kind] ?? 0) + 1 }), {});
  console.log("warnings:", JSON.stringify(byKind));
  writeFileSync(join(dirname(snapshotPath), "warnings.json"), JSON.stringify(plan.warnings, null, 2), { mode: 0o600 });

  const client = dryRun ? null : convexAdmin();
  const storageOf = await resolveFiles(client, plan, join(dirname(snapshotPath), "files.json"));
  if (!client) {
    console.log(
      "dry run:",
      JSON.stringify({ users: plan.users.length, trips: plan.trips.length, memberships: plan.memberships.length, places: plan.places.length, events: plan.events.length, expenses: plan.expenses.length, polls: plan.polls.length, documents: plan.documents.length, chats: plan.chats.length, invites: plan.invites.length })
    );
    return;
  }

  const trips = plan.trips.map(({ ai, ...trip }) => {
    const storageId = ai.avatar?.kind === "file" ? storageOf(ai.avatar.source) : null;
    return {
      ...trip,
      ai: { ...ai, avatar: ai.avatar?.kind === "bot" ? ai.avatar : storageId ? { kind: "file" as const, storageId } : null },
    };
  });
  const documents = plan.documents.flatMap(({ source, ...doc }) => {
    const storageId = storageOf(source);
    return storageId ? [{ ...doc, storageId }] : [];
  });
  const chats = plan.chats.map((chat) => ({
    ...chat,
    messages: chat.messages.map(({ image, ...message }) => {
      const storageId = image ? storageOf(image) : null;
      return storageId ? { ...message, imageStorageId: storageId } : message;
    }),
  }));

  const m = internal.migration;
  await inBatches(client, m.upsertUsers, plan.users, 25, "users");
  await inBatches(client, m.upsertTrips, trips, 10, "trips");
  await inBatches(client, m.upsertFamilies, plan.families, 50, "families");
  await inBatches(client, m.upsertMemberships, plan.memberships, 50, "memberships");
  await inBatches(client, m.upsertPlaces, plan.places, 50, "places");
  await inBatches(client, m.upsertEvents, plan.events, 50, "events");
  await inBatches(client, m.upsertExpenses, plan.expenses, 50, "expenses");
  await inBatches(client, m.upsertPolls, plan.polls, 20, "polls");
  await inBatches(client, m.upsertDocuments, documents, 50, "documents");
  await inBatches(client, m.upsertChats, chats, 5, "chats");
  await inBatches(client, m.upsertInvites, plan.invites, 50, "invites");
  await inBatches(client, m.upsertUsage, plan.usage, 50, "usage");
  console.log("load complete");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
