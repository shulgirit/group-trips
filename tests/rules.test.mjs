// Security-rules suite (Firestore + Storage) against the emulator suite:
//   npx firebase-tools emulators:exec --project demo-trips --only firestore,storage "npm run test:rules"
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";

const repo = process.argv[2] ?? process.cwd();
const env = await initializeTestEnvironment({
  projectId: "demo-rules",
  firestore: { rules: readFileSync(`${repo}/firestore.rules`, "utf8"), host: "127.0.0.1", port: 8080 },
  storage: { rules: readFileSync(`${repo}/storage.rules`, "utf8"), host: "127.0.0.1", port: 9199 },
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "trips/t1"), { name: "T1", ownerUid: "A", status: "active", settings: { membersCanDeletePlaces: true } });
  await setDoc(doc(db, "trips/t1/members/A"), { role: "owner" });
  await setDoc(doc(db, "trips/t1/members/M"), { role: "member" });
  await setDoc(doc(db, "trips/t1/members/K"), { role: "kid" });
  await setDoc(doc(db, "trips/t1/members/G2"), { role: "member", guest: true });
  await setDoc(doc(db, "trips/t1/places/p1"), { name: "x" });
  await setDoc(doc(db, "trips/t1/places/p2"), { name: "y" });
  await setDoc(doc(db, "trips/t1/events/e1"), { title: "x" });
  await setDoc(doc(db, "trips/t2"), { name: "T2", ownerUid: "B" });
  await setDoc(doc(db, "trips/sicily-2026"), { name: "S" });
  await setDoc(doc(db, "trips/sicily-2026/users/G"), { displayName: "g" });
  await setDoc(doc(db, "invites/abc12345"), { tripId: "t1" });
  await setDoc(doc(db, "users/M"), { tripIds: ["t1"] });
});

const as = (uid, provider = "google.com", extra = {}) =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: provider }, ...extra });
const results = [];
async function check(name, promise) {
  try { await promise; results.push(`PASS ${name}`); } catch (e) { results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
}
const X = as("X").firestore(), M = as("M").firestore(), K = as("K", "anonymous").firestore(), A = as("A").firestore();
const shared = as("trip-member", "custom").firestore(), G = as("G").firestore();

await check("non-member cannot read trip", assertFails(getDoc(doc(X, "trips/t1"))));
await check("non-member cannot read events", assertFails(getDocs(collection(X, "trips/t1/events"))));
await check("member reads trip", assertSucceeds(getDoc(doc(M, "trips/t1"))));
await check("member reads events", assertSucceeds(getDocs(collection(M, "trips/t1/events"))));
await check("member writes event", assertSucceeds(setDoc(doc(M, "trips/t1/events/e2"), { title: "y" })));
await check("member cannot rename trip", assertFails(updateDoc(doc(M, "trips/t1"), { name: "hack" })));
await check("member edits aboutUs", assertSucceeds(updateDoc(doc(M, "trips/t1"), { aboutUs: "hi" })));
await check("member cannot self-promote", assertFails(setDoc(doc(M, "trips/t1/members/M"), { role: "owner" })));
await check("member cannot add others", assertFails(setDoc(doc(M, "trips/t1/members/X"), { role: "member" })));
await check("member cannot touch families", assertFails(setDoc(doc(M, "trips/t1/families/f9"), { name: "z" })));
await check("owner renames trip", assertSucceeds(updateDoc(doc(A, "trips/t1"), { name: "T1b" })));
await check("owner edits families", assertSucceeds(setDoc(doc(A, "trips/t1/families/f9"), { name: "z" })));
await check("kid cannot delete place", assertFails(deleteDoc(doc(K, "trips/t1/places/p1"))));
await check("adult member deletes place", assertSucceeds(deleteDoc(doc(M, "trips/t1/places/p2"))));
await check("member of t1 cannot read t2", assertFails(getDoc(doc(M, "trips/t2"))));
await check("legacy shared identity reads sicily", assertSucceeds(getDoc(doc(shared, "trips/sicily-2026"))));
await check("legacy shared identity cannot read t1", assertFails(getDoc(doc(shared, "trips/t1"))));
await check("legacy google profile reads sicily", assertSucceeds(getDoc(doc(G, "trips/sicily-2026"))));
await check("random google cannot read sicily", assertFails(getDoc(doc(X, "trips/sicily-2026"))));
await check("invites unreadable", assertFails(getDoc(doc(A, "invites/abc12345"))));
await check("own root profile readable", assertSucceeds(getDoc(doc(M, "users/M"))));
await check("cannot forge tripIds", assertFails(updateDoc(doc(M, "users/M"), { tripIds: ["t1", "t2"] })));
await check("cannot read others' root profile", assertFails(getDoc(doc(X, "users/M"))));
await check("member shares own location", assertSucceeds(setDoc(doc(M, "trips/t1/locations/M"), { lat: 1 })));
await check("member cannot write others' location", assertFails(setDoc(doc(M, "trips/t1/locations/A"), { lat: 1 })));
const guest = as("G2", "anonymous").firestore();
await check("guest reads own trip", assertSucceeds(getDoc(doc(guest, "trips/t1"))));
await check("guest writes event", assertSucceeds(setDoc(doc(guest, "trips/t1/events/eg"), { title: "g" })));
await check("guest cannot read other trip", assertFails(getDoc(doc(guest, "trips/t2"))));
await check("guest cannot promote self", assertFails(setDoc(doc(guest, "trips/t1/members/G2"), { role: "owner" })));
await check("anonymous non-member blocked", assertFails(getDoc(doc(as("ANON", "anonymous").firestore(), "trips/t1"))));
await check("member cannot create usage", assertFails(setDoc(doc(M, "trips/t1/usage/2026-10"), { aiCalls: 0 })));

const sM = as("M", "google.com", { t: { t1: 1 } }).storage();
const sX = as("X", "google.com", { t: { t2: 1 } }).storage();
const sLegacy = as("G", "google.com", { member: true }).storage();
await check("storage: claim holder uploads photo", assertSucceeds(uploadString(ref(sM, "trips/t1/photos/a.txt"), "hi")));
await check("storage: other trip claim denied", assertFails(uploadString(ref(sX, "trips/t1/photos/b.txt"), "hi")));
await check("storage: import own folder", assertSucceeds(uploadString(ref(sM, "trips/t1/imports/M/x.txt"), "hi")));
await check("storage: import others' folder denied", assertFails(uploadString(ref(sM, "trips/t1/imports/A/x.txt"), "hi")));
await check("storage: legacy member claim works on sicily", assertSucceeds(uploadString(ref(sLegacy, "trips/sicily-2026/photos/c.txt"), "hi")));
await check("storage: legacy claim does not open t1", assertFails(uploadString(ref(sLegacy, "trips/t1/photos/c.txt"), "hi")));

console.log(results.join("\n"));
await env.cleanup();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
