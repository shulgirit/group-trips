import { convexTest } from "convex-test";
import type { Id } from "../convex/_generated/dataModel";
import schema from "../convex/schema";

// Every function module plus _generated; betterAuth/auth.ts is only for schema generation
export const modules = import.meta.glob([
  "../convex/**/*.ts",
  "../convex/_generated/*.js",
  "!../convex/**/*.d.ts",
  "!../convex/betterAuth/auth.ts",
]);

export function makeTest() {
  return convexTest(schema, modules);
}
export type T = ReturnType<typeof makeTest>;

let counter = 0;

/** Inserts an app user (as the Better Auth trigger would) and returns a client acting as them. */
export async function userClient(t: T, options: { name?: string; guest?: boolean } = {}) {
  const authId = `auth-${++counter}`;
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", {
      authId,
      name: options.name ?? `User ${counter}`,
      email: options.guest ? undefined : `user${counter}@example.com`,
      guest: Boolean(options.guest),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
  return { userId, as: t.withIdentity({ subject: authId, name: options.name }) };
}

export const tripInput = (over: Record<string, unknown> = {}) => ({
  name: "Sicily summer",
  emoji: "sun",
  stops: [
    {
      id: "s1",
      label: "Sicily",
      region: "Sicily",
      country: "IT",
      timezone: "Europe/Rome",
      currency: "EUR",
      coverImage: "https://example.com/cover.jpg",
      lat: 37.6,
      lng: 14,
      startDate: "2099-08-15",
      endDate: "2099-08-24",
    },
  ],
  departureAt: null,
  homeBase: null,
  groupKind: "families" as const,
  groupName: "Tal & Levi",
  families: [
    { id: "f-tal", name: "Tal family", members: [{ id: "m-omer", name: "Omer" }, { id: "m-noa", name: "Noa", kid: true, age: 9 }] },
    { id: "f-levi", name: "Levi family", members: [{ id: "m-yossi", name: "Yossi" }] },
  ],
  ai: { name: "The Concierge", emoji: "butler", avatar: { kind: "bot" as const, id: "butler" }, preset: "butler" as const, rules: [], customRules: "" },
  me: { familyId: "f-tal", memberId: "m-omer" },
  status: "active" as const,
  ...over,
});
