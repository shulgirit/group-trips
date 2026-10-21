import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
const client = new ConvexHttpClient(process.env.CONVEX_URL);
client.setAuth(process.env.AUTH_TOKEN);
const today = new Date();
const iso = (o) => new Date(today.getTime() + o * 86_400_000).toISOString().slice(0, 10);
const tripId = process.env.TRIP || await client.mutation(anyApi.trips.create, { input: {
  name: "London Getaway", emoji: "sun",
  stops: [{ id: "s1", label: "London", region: "England", country: "GB", timezone: "Europe/London", currency: "GBP",
    coverImage: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1600&q=70", lat: 51.5074, lng: -0.1278, startDate: iso(-1), endDate: iso(5) }],
  departureAt: null, homeBase: null, groupKind: "friends", groupName: "The London crew",
  families: [
    { id: "f1", name: "Alex & Sam", members: [{ id: "m1", name: "Alex" }, { id: "m2", name: "Sam" }] },
    { id: "f2", name: "Jamie & Riley", members: [{ id: "m3", name: "Jamie" }, { id: "m4", name: "Riley" }] },
  ],
  ai: { name: "The Concierge", emoji: "butler", avatar: { kind: "bot", id: "butler" }, preset: "butler", rules: [], customRules: "" },
  me: { familyId: "f1", memberId: "m1" }, status: "active",
} });
console.log("TRIP", tripId);
const wanted = [
  ["Tower of London", 1, "10:00", 150], ["Borough Market", 1, "13:00", 90], ["Tate Modern", 2, "11:00", 120],
  ["Sky Garden London", 2, "17:30", 60], ["British Museum", 3, "10:30", 150], ["Camden Market", 3, "15:00", 90],
  ["Buckingham Palace", 4, "09:30", 90], ["Hyde Park", 4, "13:00", 90], ["Notting Hill Portobello Road Market", 5, "11:00", 120],
];
const placeIds = {};
for (const [name, day, start, dur] of wanted) {
  const found = await client.action(anyApi.placesAi.search, { tripId, query: name });
  const p = found[0]; if (!p) { console.log("no result", name); continue; }
  const added = await client.mutation(anyApi.places.add, { tripId, input: { name: p.name, category: p.category, area: p.area, address: p.address, lat: p.lat, lng: p.lng, website: p.website, imageUrl: p.imageUrl, recommendedDurationMin: dur } });
  const id = added.id;
  placeIds[name] = id;
  await client.mutation(anyApi.events.add, { tripId, input: { title: p.name, placeId: id, day: iso(day - 1 + 0), startTime: start, durationMin: dur, participants: { type: "all" } } });
  console.log("ok", p.name, !!p.imageUrl);
}
const fams = await client.query(anyApi.families.list, { tripId });
const [f1, f2] = fams.map((f) => f._id);
for (const [d, amt, who, day] of [["Oyster cards", 60, f1, -1], ["Dinner at Dishoom", 96.5, f2, -1], ["Tower of London tickets", 134, f1, 0], ["Borough Market lunch", 48.2, f2, 0], ["Thames river cruise", 72, f1, 1]])
  await client.mutation(anyApi.expenses.add, { tripId, payerFamilyId: who, description: d, amount: amt, currency: "GBP", date: iso(day), participantFamilyIds: null });
await client.mutation(anyApi.polls.create, { tripId, question: "Where should we have dinner on Friday?", options: [{ label: "Dishoom Covent Garden" }, { label: "Padella Pasta" }, { label: "Flat Iron Steak" }] });
console.log("DONE", tripId);
