// App icon concepts via the OpenAI image API. Key from the environment only.
//   OPENAI_API_KEY=$(cd ../../packages/backend && npx convex env get OPENAI_API_KEY) node scripts/gen-icon.mjs
import { mkdir, writeFile } from "node:fs/promises";
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Set OPENAI_API_KEY");
const out = "assets/icon-concepts";
await mkdir(out, { recursive: true });
const BASE =
  "A premium iOS app icon, full-bleed square artwork with no rounded corners and no border, centered single hero object, " +
  "soft studio lighting, subtle depth and glossy highlights, rich saturated colors, clean modern 3D render, " +
  "no text, no letters other than the mark described, no watermark. ";
const CONCEPTS = {
  a: BASE + "A bold glossy 3D letter T built from two smooth curved ribbons that sweep in from the upper left and upper right and merge into one vertical stem, with a small shining gold sphere at the merge point. Background: a vivid gradient from deep teal to warm coral-orange, like a sunset sea.",
  b: BASE + "A 3D chunky glass-and-gold letter T whose top bar curves like a road or route, a tiny gold pin marker at its center, floating above a soft glowing gradient background of electric blue to magenta to peach.",
  c: BASE + "Two glossy 3D rounded paths, one gold and one white, curving toward each other and joining at a glowing node and continuing as a single path downward, forming the shape of a T. Background: a luminous gradient from midnight navy to turquoise with a soft light bloom.",
};
for (const [name, prompt] of Object.entries(CONCEPTS)) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "high", n: 2 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${name}: ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  for (const [i, item] of json.data.entries()) {
    await writeFile(`${out}/icon-${name}${i + 1}.png`, Buffer.from(item.b64_json, "base64"));
    console.log("saved", `icon-${name}${i + 1}.png`);
  }
}
