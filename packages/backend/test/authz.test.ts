import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTest, tripInput, userClient } from "./setup";

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: { data?: { code?: string; detail?: string } }) => error.data?.detail ?? error.data?.code ?? String(error)
  );

async function tripWithOwner() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer" });
  const tripId = await owner.as.mutation(api.trips.create, { input: tripInput() });
  return { t, owner, tripId };
}

async function join(t: ReturnType<typeof makeTest>, tripId: string, options: { guest?: boolean; role?: "admin" | "member" | "kid" } = {}) {
  const person = await userClient(t, { guest: options.guest });
  const inviteCode = await t.run(async (ctx) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId as never))
      .first();
    if (options.role && invite) await ctx.db.patch(invite._id, { role: options.role });
    return invite!.code;
  });
  await person.as.mutation(api.invites.redeem, { code: inviteCode });
  return person;
}

describe("trip access", () => {
  it("rejects signed-out callers and non-members", async () => {
    const { t, tripId } = await tripWithOwner();
    expect(await code(t.query(api.places.list, { tripId }))).toBe("unauthenticated");
    const stranger = await userClient(t);
    expect(await code(stranger.as.query(api.places.list, { tripId }))).toBe("not_member");
    expect(await code(stranger.as.query(api.trips.get, { tripId }))).toBe("not_member");
  });

  it("creates the owner seat, families and default invites", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const { me } = await owner.as.query(api.trips.get, { tripId });
    expect(me.role).toBe("owner");
    expect(me.memberKey).toBe("m-omer");
    const families = await owner.as.query(api.families.list, { tripId });
    expect(families.map((f) => f.key)).toEqual(["f-tal", "f-levi"]);
    const invites = await owner.as.query(api.invites.list, { tripId });
    expect(invites).toHaveLength(3); // general + one per family
    void t;
  });

  it("guest devices cannot create trips", async () => {
    const t = makeTest();
    const guest = await userClient(t, { guest: true });
    expect(await code(guest.as.mutation(api.trips.create, { input: tripInput() }))).toBe("sign_in_required");
  });

  it("only organizers manage invites and trip settings", async () => {
    const { t, tripId } = await tripWithOwner();
    const member = await join(t, tripId);
    expect(await code(member.as.query(api.invites.list, { tripId }))).toBe("forbidden");
    expect(await code(member.as.mutation(api.trips.setSettings, { tripId, membersCanDeletePlaces: false }))).toBe("forbidden");
    expect(await code(member.as.mutation(api.trips.remove, { tripId }))).toBe("forbidden");
  });
});

describe("invites", () => {
  it("counts uses once per person and stops at maxUses", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const invite = await t.run(async (ctx) => {
      const row = (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).first())!;
      await ctx.db.patch(row._id, { maxUses: 2 });
      return row;
    });
    const a = await userClient(t);
    await a.as.mutation(api.invites.redeem, { code: invite.code });
    await a.as.mutation(api.invites.redeem, { code: invite.code }); // again: no extra use
    const b = await userClient(t);
    await b.as.mutation(api.invites.redeem, { code: invite.code });
    const c = await userClient(t);
    expect(await code(c.as.mutation(api.invites.redeem, { code: invite.code }))).toBe("used_up");
    const members = await owner.as.query(api.memberships.list, { tripId });
    expect(members).toHaveLength(3);
  });

  it("refuses expired and revoked links", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const [first, second] = await t.run(async (ctx) => {
      const rows = await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).collect();
      await ctx.db.patch(rows[0]._id, { expiresAt: Date.now() - 1 });
      return rows;
    });
    await owner.as.mutation(api.invites.revoke, { tripId, code: second.code });
    const person = await userClient(t);
    expect(await code(person.as.mutation(api.invites.redeem, { code: first.code }))).toBe("expired");
    expect(await code(person.as.mutation(api.invites.redeem, { code: second.code }))).toBe("revoked");
  });

  it("a kid link on a real account joins as an adult; guests can't take admin links", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    await join(t, tripId, { role: "kid" });
    const members = await owner.as.query(api.memberships.list, { tripId });
    expect(members.find((m) => !m.isMe)?.role).toBe("member");
    const guest = await userClient(t, { guest: true });
    const adminCode = await owner.as.mutation(api.invites.create, { tripId, role: "admin" });
    expect(await code(guest.as.mutation(api.invites.redeem, { code: adminCode }))).toBe("sign_in_required");
  });

  it("never downgrades an organizer who opens a member link", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const memberCode = await owner.as.mutation(api.invites.create, { tripId, role: "member" });
    await owner.as.mutation(api.invites.redeem, { code: memberCode });
    const { me } = await owner.as.query(api.trips.get, { tripId });
    expect(me.role).toBe("owner");
    void t;
  });
});

describe("shared content rules", () => {
  it("dedupes places and respects the delete setting", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const member = await join(t, tripId);
    const first = await member.as.mutation(api.places.add, { tripId, input: { name: "Teatro Antico di Taormina", category: "attraction", imageUrl: "https://example.com/a.jpg" } });
    const again = await owner.as.mutation(api.places.add, { tripId, input: { name: "teatro antico di taormina", category: "attraction", imageUrl: "https://example.com/a.jpg" } });
    expect(again).toEqual({ id: first.id, existed: true });

    await owner.as.mutation(api.trips.setSettings, { tripId, membersCanDeletePlaces: false });
    expect(await code(member.as.mutation(api.places.remove, { tripId, placeId: first.id }))).toBe("forbidden");
    await owner.as.mutation(api.places.remove, { tripId, placeId: first.id });
    expect(await owner.as.query(api.places.list, { tripId })).toHaveLength(0);
  });

  it("one vote per person, none on closed polls", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const member = await join(t, tripId);
    const pollId = await owner.as.mutation(api.polls.create, { tripId, question: "Beach or town?", options: [{ label: "Beach" }, { label: "Town" }] });
    const [poll] = await owner.as.query(api.polls.list, { tripId });
    const [beach, town] = poll.options;
    await member.as.mutation(api.polls.vote, { tripId, pollId, optionId: beach.id });
    await member.as.mutation(api.polls.vote, { tripId, pollId, optionId: town.id });
    const [after] = await member.as.query(api.polls.list, { tripId });
    expect(after.votes).toHaveLength(1);
    expect(after.myVote).toBe(town.id);
    await owner.as.mutation(api.polls.setClosed, { tripId, pollId, closed: true });
    expect(await code(owner.as.mutation(api.polls.vote, { tripId, pollId, optionId: beach.id }))).toBe("closed");
  });

  it("private documents are visible only to their owner", async () => {
    const { t, owner, tripId } = await tripWithOwner();
    const member = await join(t, tripId);
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob(["%PDF-1.4"], { type: "application/pdf" })));
    await owner.as.mutation(api.documents.create, { tripId, storageId, name: "passport.pdf", visibility: "private" });
    expect(await owner.as.query(api.documents.list, { tripId })).toHaveLength(1);
    expect(await member.as.query(api.documents.list, { tripId })).toHaveLength(0);
    const [doc] = await owner.as.query(api.documents.list, { tripId });
    expect(await code(member.as.mutation(api.documents.remove, { tripId, documentId: doc._id }))).toBe("forbidden");
  });

  it("rejects settlements between the same family or of no money", async () => {
    const { owner, tripId } = await tripWithOwner();
    const [tal, levi] = await owner.as.query(api.families.list, { tripId });
    const args = { tripId, currency: "EUR", date: "2099-08-20" };
    expect(await code(owner.as.mutation(api.expenses.recordSettlement, { ...args, fromFamilyId: tal._id, toFamilyId: tal._id, amount: 10 }))).toBe("settlement");
    expect(await code(owner.as.mutation(api.expenses.recordSettlement, { ...args, fromFamilyId: tal._id, toFamilyId: levi._id, amount: 0 }))).toBe("settlement");
    await owner.as.mutation(api.expenses.recordSettlement, { ...args, fromFamilyId: tal._id, toFamilyId: levi._id, amount: 33.333 });
    const [row] = await owner.as.query(api.expenses.list, { tripId });
    expect(row.amount).toBe(33.33);
    expect(row.kind).toBe("settlement");
  });
});
