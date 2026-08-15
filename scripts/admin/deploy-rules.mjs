// Deploys firestore.rules + storage.rules via the Firebase Rules REST API.
// (The Firebase CLI can't be used — the service account lacks serviceusage
// permission.) Run remotely: gh workflow run admin.yml -f script=deploy-rules.mjs
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const PROJECT = "group-trips-2f753";
const BUCKET = "group-trips-2f753.firebasestorage.app";
const BASE = `https://firebaserules.googleapis.com/v1/projects/${PROJECT}`;

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const token = await auth.getAccessToken();
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function deploy(fileName, releaseId) {
  const content = readFileSync(fileName, "utf8");
  const ruleset = await api("POST", "/rulesets", {
    source: { files: [{ name: fileName, content }] },
  });
  const release = encodeURIComponent(releaseId);
  await api("PATCH", `/releases/${release}`, {
    release: {
      name: `projects/${PROJECT}/releases/${releaseId}`,
      rulesetName: ruleset.name,
    },
  });
  console.log(`✓ ${fileName} → ${releaseId} (${ruleset.name.split("/").pop()})`);
}

await deploy("firestore.rules", "cloud.firestore");
await deploy("storage.rules", `firebase.storage/${BUCKET}`);
console.log("rules deployed");
