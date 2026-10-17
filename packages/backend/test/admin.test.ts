import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeTest, tripInput, userClient } from "./setup";

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: { data?: { code?: string; detail?: string } }) => error.data?.detail ?? error.data?.code ?? String(error)
  );

async function setup() {
  const t = makeTest();
  const admin = await userClient(t, { name: "Owner" });
  await t.run((ctx) => ctx.db.patch(admin.userId, { email: "owner@example.com" }));
  await t.mutation(internal.admin.grantAdmin, { email: "Owner@Example.com" });
  const member = await userClient(t, { name: "Dana" });
  const guest = await userClient(t, { name: "Kid", guest: true });
  const tripId = await member.as.mutation(api.trips.create, { input: tripInput() });
  return { t, admin, member, guest, tripId };
}

describe("admin API is for platform owners only", () => {
  it("rejects signed-out users, guests and ordinary accounts on every function", async () => {
    const { t, member, guest, tripId } = await setup();
    const anonymous = t;
    const calls: [string, (c: typeof t) => Promise<unknown>][] = [
      ["overview", (c) => c.query(api.admin.overview, {})],
      ["listTrips", (c) => c.query(api.admin.listTrips, {})],
      ["listUsers", (c) => c.query(api.admin.listUsers, {})],
      ["auditLog", (c) => c.query(api.admin.auditLog, {})],
      ["listConfig", (c) => c.query(api.admin.listConfig, {})],
      ["setTripStatus", (c) => c.mutation(api.admin.setTripStatus, { tripId, status: "archived" })],
      ["setConfig", (c) => c.mutation(api.admin.setConfig, { key: "banner", value: "hi" })],
    ];
    for (const [name, call] of calls) {
      expect(await code(call(anonymous)), `${name} signed out`).toBe("unauthenticated");
      expect(await code(call(guest.as as unknown as typeof t)), `${name} guest`).toBe("sign_in_required");
      expect(await code(call(member.as as unknown as typeof t)), `${name} member`).toBe("forbidden");
    }
    expect((await t.run((ctx) => ctx.db.get(tripId)))?.status).toBe("active");
  });

  it("grantAdmin is CLI-only and needs an existing account", async () => {
    const { t, member } = await setup();
    // An ordinary signed-in client must not be able to invoke an internal function
    const callAny = member.as.mutation.bind(member.as) as unknown as (fn: unknown, args: unknown) => Promise<unknown>;
    await expect(callAny(internal.admin.grantAdmin, { email: "x@y.z" })).rejects.toThrow();
    await expect(t.mutation(internal.admin.grantAdmin, { email: "nobody@example.com" })).rejects.toThrow(/sign in once/);
    expect(await t.mutation(internal.admin.grantAdmin, { email: "owner@example.com" })).toBe("already_admin");
  });

  it("me() tells the panel who is an admin without throwing", async () => {
    const { t, admin, member, guest } = await setup();
    expect(await t.query(api.admin.me, {})).toEqual({ isAdmin: false });
    expect(await guest.as.query(api.admin.me, {})).toEqual({ isAdmin: false });
    expect(await member.as.query(api.admin.me, {})).toMatchObject({ isAdmin: false });
    expect(await admin.as.query(api.admin.me, {})).toMatchObject({ isAdmin: true });
  });

  it("an admin sees the overview, can archive a trip, and every change is audited", async () => {
    const { admin, tripId } = await setup();
    const overview = await admin.as.query(api.admin.overview, {});
    expect(overview.users.accounts).toBe(2);
    expect(overview.users.guests).toBe(1);
    expect(overview.trips).toMatchObject({ total: 1, active: 1, archived: 0 });
    expect(overview.topCountries).toEqual([{ country: "IT", count: 1 }]);

    const trips = await admin.as.query(api.admin.listTrips, { search: "sicily" });
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ ownerName: "Dana", members: 1, countries: ["IT"] });
    const users = await admin.as.query(api.admin.listUsers, { search: "owner@" });
    expect(users).toHaveLength(1);
    expect(Object.keys(users[0]).sort()).toEqual(["createdAt", "email", "guest", "id", "locale", "name"]);

    await admin.as.mutation(api.admin.setTripStatus, { tripId, status: "archived" });
    expect((await admin.as.query(api.admin.overview, {})).trips.archived).toBe(1);
    const log = await admin.as.query(api.admin.auditLog, {});
    expect(log[0]).toMatchObject({ action: "set_trip_status", target: tripId, detail: "active -> archived", admin: "Owner" });
    expect(log.map((row) => row.action)).toContain("grant_admin");
  });

  it("remote config: admins write (validated, audited), everyone reads", async () => {
    const { t, admin, member } = await setup();
    await expect(admin.as.mutation(api.admin.setConfig, { key: "Bad Key!", value: 1 })).rejects.toThrow(/invalid_key/);
    await admin.as.mutation(api.admin.setConfig, { key: "banner.he", value: { text: "שלום", until: "2026-12-01" } });
    await admin.as.mutation(api.admin.setConfig, { key: "banner.he", value: { text: "עדכון" } });
    expect(await member.as.query(api.config.get, { keys: ["banner.he", "missing"] })).toEqual({ "banner.he": { text: "עדכון" } });
    expect(await t.query(api.config.get, { keys: ["banner.he"] })).toEqual({ "banner.he": { text: "עדכון" } });
    expect(await t.run((ctx) => ctx.db.query("appConfig").collect())).toHaveLength(1);
    expect((await admin.as.query(api.admin.auditLog, {})).filter((row) => row.action === "set_config")).toHaveLength(2);
  });
});
