// Artwork for the New trip chooser (bright vacation look, landscape cards).
//   OPENAI_API_KEY=$(cd ../../packages/backend && npx convex env get OPENAI_API_KEY) node scripts/gen-start.mjs [--n 2]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Set OPENAI_API_KEY");
const n = Number(process.argv.includes("--n") ? process.argv[process.argv.indexOf("--n") + 1] : "2");
const out = path.resolve("assets/onboarding/concepts");
await mkdir(out, { recursive: true });

const STYLE =
  "Bright, airy, sun-drenched vacation photography, natural daylight, fresh turquoise and white and warm sand tones with a few warm gold accents, " +
  "joyful holiday mood, shallow depth of field, soft film grain, wide landscape composition with the lower third calmer and slightly darker (space for text), " +
  "no text, no letters, no logos, no watermarks, no maps, no map lines.";

const PAGES = {
  "start-ai":
    "Dreamy Mediterranean coastline at golden hour seen from a sunlit terrace: turquoise sea, a whitewashed cliff village with bougainvillea, a white sailboat on the water, a breakfast table with fruit and iced coffee in the foreground. " + STYLE,
  "start-manual":
    "Beach holiday flat lay on pale sand at the water's edge: a straw sun hat, sunglasses, a passport and boarding pass without readable text, flip-flops and a paperback, turquoise shallow water and gentle waves behind, bright midday light. " + STYLE,
};

for (const [name, prompt] of Object.entries(PAGES)) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1536x1024", quality: "medium", n }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  for (const [i, item] of json.data.entries()) {
    await writeFile(path.join(out, `${name}-${i + 1}.png`), Buffer.from(item.b64_json, "base64"));
    console.log("saved", `${name}-${i + 1}.png`);
  }
}
