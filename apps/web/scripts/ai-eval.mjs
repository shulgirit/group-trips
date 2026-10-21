// AI guide eval: realistic requests on fresh throw-away trips, with assertions on what got created
// and how long it took. Run before/after changing the model, prompt or reasoning settings.
//
//   CONVEX_URL=https://<dev deployment>.convex.cloud AUTH_TOKEN=<better-auth.convex_jwt cookie value> \
//     node apps/web/scripts/ai-eval.mjs [--runs 2]
//
// AUTH_TOKEN: sign in on the dev deployment (web on localhost:3100) and copy the `better-auth.convex_jwt`
// cookie (short-lived — fetch a fresh one per run). Trips it creates are deleted at the end.
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url = process.env.CONVEX_URL;
const token = process.env.AUTH_TOKEN;
if (!url || !token) throw new Error("Set CONVEX_URL and AUTH_TOKEN");
if (/tidy-dodo-188/.test(url)) throw new Error("Refusing to run the eval against production");
const runs = Number(process.argv[process.argv.indexOf("--runs") + 1]) || 1;
const client = new ConvexHttpClient(url);
client.setAuth(token);

const today = new Date();
const iso = (offset) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const tripInput = () => ({
  name: "AI eval (temporary)", emoji: "sun",
  stops: [{ id: "s1", label: "Taormina", region: "Sicily", country: "IT", timezone: "Europe/Rome", currency: "EUR", coverImage: "https://example.com/c.jpg", lat: 37.85, lng: 15.29, startDate: iso(-2), endDate: iso(5) }],
  departureAt: null, homeBase: null, groupKind: "families", groupName: "Eval",
  families: [{ id: "f1", name: "Eval family", members: [{ id: "m1", name: "Omer" }, { id: "m2", name: "Noa", kid: true, age: 9 }] }],
  ai: { name: "The Concierge", emoji: "butler", avatar: { kind: "bot", id: "butler" }, preset: "butler", rules: [], customRules: "" },
  me: { familyId: "f1", memberId: "m1" }, status: "active",
});

const scenarios = [
  { name: "recommend (no side effects)", text: "Recommend 3 great beaches near Taormina for kids", expect: (r) => r.candidates >= 1 && r.events === 0 },
  { name: "schedule a known kind of place", text: "Add dinner at Trattoria da Nino in Taormina tomorrow at 20:00 for everyone", expect: (r) => r.events >= 1 },
  { name: "poll", text: "Create a poll: beach or old town tomorrow?", expect: (r) => r.polls >= 1 },
  { name: "plan a day", text: "Plan tomorrow for us: morning beach, lunch, evening in the old town. Add it to the schedule.", expect: (r) => r.events >= 2 },
];

const rows = [];
for (const scenario of scenarios) {
  for (let i = 0; i < runs; i++) {
    const tripId = await client.mutation(anyApi.trips.create, { input: tripInput() });
    const started = Date.now();
    const { sessionId, replyId } = await client.mutation(anyApi.chat.send, { tripId, text: scenario.text, locale: "en" });
    let reply;
    let firstText = null;
    while (Date.now() - started < 120_000) {
      const messages = await client.query(anyApi.chat.messages, { tripId, sessionId });
      reply = messages.find((m) => m._id === replyId);
      // streaming: the reply shows words while it is still pending
      if (firstText === null && reply?.content) firstText = Date.now() - started;
      if (reply && reply.status !== "pending") break;
      await new Promise((r) => setTimeout(r, 120));
    }
    const ms = Date.now() - started;
    const [events, polls, places] = await Promise.all([
      client.query(anyApi.events.list, { tripId }),
      client.query(anyApi.polls.list, { tripId }),
      client.query(anyApi.places.list, { tripId }),
    ]);
    const result = { events: events.length, polls: polls.length, places: places.length, candidates: reply?.candidates?.length ?? 0 };
    rows.push({ scenario: scenario.name, firstText: firstText === null ? null : +(firstText / 1000).toFixed(1), seconds: +(ms / 1000).toFixed(1), status: reply?.status, ...result, pass: reply?.status === "done" && scenario.expect(result) });
    await client.mutation(anyApi.trips.remove, { tripId });
  }
}
console.table(rows);
const secs = rows.map((r) => r.seconds).sort((a, b) => a - b);
const firsts = rows.map((r) => r.firstText).filter((x) => x !== null).sort((a, b) => a - b);
console.log(`pass ${rows.filter((r) => r.pass).length}/${rows.length} | total p50 ${secs[Math.floor(secs.length / 2)]}s max ${secs.at(-1)}s | first words p50 ${firsts[Math.floor(firsts.length / 2)] ?? "-"}s max ${firsts.at(-1) ?? "-"}s`);
