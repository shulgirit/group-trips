// Live check of the planner prompts (costs a few cents).  OPENAI_API_KEY=… tsx scripts/planner-eval.ts
import { resolveDatePhrase } from "@together/shared/holidays";
import { generatePlan } from "../src/planner";

const today = new Date().toISOString().slice(0, 10);
const cases = [
  { text: "I want to go to Vietnam in the summer, two couples, we love food and nature", locale: "en" },
  { text: "נרצה לטייל בפסח עם שלושה ילדים (גילאי 4, 7, 10) באירופה, משהו רגוע", locale: "he" },
  { text: "somewhere warm in November, me and my wife, 5 days, a bit of beach and good wine", locale: "en" },
];
for (const c of cases) {
  const started = Date.now();
  const window = resolveDatePhrase(c.text, today);
  const { outline, days } = await generatePlan({ ...c, today, window });
  const items = days.flatMap((d) => d.items);
  console.log(`\n=== ${c.text.slice(0, 60)}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  console.log(`${outline.title} | ${outline.startDate} → ${outline.endDate} | window: ${window ? `${window.label} ${window.start}→${window.end}` : "none"}`);
  console.log(`stops: ${outline.stops.map((s) => `${s.label} ${s.nights}n`).join(" → ")} | group: ${outline.group.adults}A ${outline.group.kidAges.join(",")} (${outline.group.kind})`);
  console.log(`days: ${days.length} | items: ${items.length} | kinds: ${JSON.stringify(items.reduce((a: Record<string, number>, i) => ({ ...a, [i.kind]: (a[i.kind] ?? 0) + 1 }), {}))}`);
  console.log(`day 1: ${days[0]?.items.map((i) => `${i.time} ${i.title}`).join(" | ")}`);
}
