import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeTest, tripInput, userClient } from "./setup";

const token = (n: number) => `ExponentPushToken[device-${String(n).padStart(6, "0")}]`;

async function setup() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer" });
  const tripId = await owner.as.mutation(api.trips.create, { input: tripInput() });
  const code = await t.run(async (ctx) => (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).first())!.code);
  const member = await userClient(t, { name: "Dana" });
  await member.as.mutation(api.invites.redeem, { code });
  const outsider = await userClient(t, { name: "Eve" });
  return { t, owner, member, outsider, tripId };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("app push tokens", () => {
  it("rejects anything that isn't an Expo token", async () => {
    const { owner } = await setup();
    await expect(owner.as.mutation(api.push.registerApp, { token: "https://evil.example/hook", platform: "ios", locale: "he" })).rejects.toThrow();
  });

  it("a device follows whoever signed in on it last", async () => {
    const { t, owner, member } = await setup();
    await owner.as.mutation(api.push.registerApp, { token: token(1), platform: "ios", locale: "he" });
    await member.as.mutation(api.push.registerApp, { token: token(1), platform: "ios", locale: "en" });
    const rows = await t.run((ctx) => ctx.db.query("appPushTokens").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: member.userId, locale: "en" });
    // Only the current holder can unregister it
    await owner.as.mutation(api.push.unregisterApp, { token: token(1) });
    expect(await t.run((ctx) => ctx.db.query("appPushTokens").collect())).toHaveLength(1);
    await member.as.mutation(api.push.unregisterApp, { token: token(1) });
    expect(await t.run((ctx) => ctx.db.query("appPushTokens").collect())).toHaveLength(0);
  });

  it("group notices reach members' devices in their language, never the actor or outsiders; dead devices are dropped", async () => {
    const { t, owner, member, outsider, tripId } = await setup();
    await owner.as.mutation(api.push.registerApp, { token: token(1), platform: "ios", locale: "he" });
    await member.as.mutation(api.push.registerApp, { token: token(2), platform: "android", locale: "en" });
    await member.as.mutation(api.push.registerApp, { token: token(3), platform: "ios", locale: "en" });
    await outsider.as.mutation(api.push.registerApp, { token: token(4), platform: "ios", locale: "en" });

    const sent: { to: string; title: string; data: { url: string } }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        const messages = JSON.parse(init.body) as typeof sent;
        sent.push(...messages);
        const data = messages.map((m) => (m.to === token(3) ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" }));
        return new Response(JSON.stringify({ data }), { status: 200 });
      })
    );
    const result = await t.action(internal.pushSend.toTrip, { tripId, notice: { type: "poll", title: "Beach or town?" }, excludeUserId: owner.userId });

    expect(sent.map((m) => m.to).sort()).toEqual([token(2), token(3)]);
    expect(sent[0].title).toBe("New group poll");
    expect(sent[0].data.url).toBe(`/t/${tripId}/polls`);
    expect(result.sent).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("appPushTokens").collect());
    expect(left.map((r) => r.token).sort()).toEqual([token(1), token(2), token(4)]);
  });

  it("deleting the account removes its devices", async () => {
    const { t, member } = await setup();
    await member.as.mutation(api.push.registerApp, { token: token(5), platform: "ios", locale: "he" });
    const authId = await t.run(async (ctx) => (await ctx.db.get(member.userId))!.authId);
    await t.mutation(internal.account.purgeForAuthUser, { authId });
    expect(await t.run((ctx) => ctx.db.query("appPushTokens").collect())).toHaveLength(0);
  });
});
