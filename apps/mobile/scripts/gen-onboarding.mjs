// Generates onboarding artwork with the OpenAI image API.
//   OPENAI_API_KEY=$(cd ../../packages/backend && npx convex env get OPENAI_API_KEY) node scripts/gen-onboarding.mjs [--n 2] [--out assets/onboarding/concepts]
// The key is read from the environment only; nothing is stored. No text or logos inside the images.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Set OPENAI_API_KEY");
const arg = (name, fallback) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback);
const n = Number(arg("--n", "2"));
const out = path.resolve(arg("--out", "assets/onboarding/concepts"));
await mkdir(out, { recursive: true });

const STYLE =
  "Cinematic, premium travel photography look, warm golden-hour light, deep navy shadows, soft film grain, shallow depth of field, " +
  "vertical composition with the lower 40% darker and quieter (space for text), no text, no letters, no logos, no watermarks, no UI.";

const PAGES = {
  group:
    "Six friends and two kids laughing together around a long table on a terrace overlooking a Mediterranean bay at sunset, seen from behind and the side, faces soft and natural, warm lights strung overhead. " + STYLE,
  guide:
    "An abstract luminous scene: a dark navy night sky gradient with a soft glowing gold orb of light at the center-top and delicate floating constellation lines, subtle paper map texture, a feeling of an intelligent friendly guide, room in the middle for a character to sit. " + STYLE,
  plan:
    "Close-up of a table at night with a vintage travel map and a glowing phone showing a blurred route, passports, a coffee, a brass compass, warm lamp light, a hand pointing at the map; gold route line glowing across the map. " + STYLE,
};

for (const [name, prompt] of Object.entries(PAGES)) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1536", quality: "medium", n }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  for (const [i, item] of json.data.entries()) {
    await writeFile(path.join(out, `${name}-${i + 1}.png`), Buffer.from(item.b64_json, "base64"));
    console.log("saved", `${name}-${i + 1}.png`);
  }
}
