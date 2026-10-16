import { describe, expect, it } from "vitest";
import type { Snapshot } from "../src/snapshot";
import { transform } from "../src/transform";

const google = (uid: string, email: string) => ({
  uid,
  email,
  emailVerified: true,
  displayName: email.split("@")[0],
  disabled: false,
  createdAt: 1_700_000_000_000,
  providers: [{ providerId: "google.com", uid: `g-${uid}`, email }],
});

function fixture(): Snapshot {
  return {
    exportedAt: 1_800_000_000_000,
    projectId: "demo",
    authUsers: [
      google("omer", "omer@example.com"),
      google("dana", "dana@example.com"),
      // Anonymous guest device (no provider) that voted
      { uid: "anon1", emailVerified: false, disabled: false, createdAt: 1, providers: [] },
    ],
    users: [{ id: "omer", data: { displayName: "Omer Tal", tripIds: ["sicily-2026", "abc123"] } }],
    invites: [
      { id: "code1234", data: { tripId: "abc123", role: "member", familyId: "f-tal", createdBy: "omer", expiresAt: 9e12, maxUses: 5, uses: 1, revoked: false, createdAt: 1 } },
      { id: "orphan99", data: { tripId: "gone", role: "member", createdBy: "omer" } },
    ],
    trips: [
      {
        id: "sicily-2026",
        data: { name: "סיציליה 2026", aboutUs: "ארבע משפחות", joinCode: "secret" },
        collections: {
          users: [
            { id: "omer", data: { displayName: "Omer", familyId: "tal", memberId: "omer", createdAt: 5 } },
            { id: "member-noa", data: { displayName: "Noa", familyId: "tal", memberId: "noa" } },
          ],
          families: [{ id: "tal", data: { name: "Tal", color: "sea", order: 0, members: [{ id: "omer", name: "Omer" }, { id: "noa", name: "Noa", kid: true }] } }],
          places: [
            { id: "villa", data: { name: "Villa Maria", category: "accommodation", lat: 38, lng: 12.9, createdByUid: "omer" } },
            { id: "weird", data: { name: "Lido", category: "lido" } },
            { id: "blank", data: { name: "  " } },
          ],
          events: [
            { id: "e1", data: { title: "Dinner", day: "2026-08-16", startTime: "20:00", placeId: "villa", participants: { type: "families", familyIds: ["tal", "ghost"] }, reminderSentAt: 123 } },
            { id: "e2", data: { title: "Broken", day: "16/8", startTime: "8pm" } },
          ],
          expenses: [
            { id: "x1", data: { payerFamilyId: "tal", description: "Gelato", amount: 12.5, currency: "EUR", date: "2026-08-17", participantFamilyIds: null } },
            { id: "x2", data: { payerFamilyId: "nobody", amount: 10, currency: "EUR", date: "2026-08-17" } },
          ],
          polls: [
            {
              id: "global",
              data: {
                question: "Ideas",
                options: [{ id: "o1", label: "Beach", placeId: "villa" }],
                votes: { omer: { optionId: "o1", name: "Omer" }, "member-noa": "o1", anon1: { optionId: "missing", name: "x" } },
              },
            },
          ],
          chatSessions: [
            {
              id: "c1",
              data: {
                ownerUid: "omer",
                title: "Plans",
                createdAt: 10,
                messages: [
                  { role: "user", content: "photo", imageUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media&token=t" },
                  { role: "assistant", content: "Try these", candidates: [{ name: "Villa Maria", description: "", why: "", savedPlaceId: "villa" }] },
                ],
              },
            },
          ],
        },
      },
      {
        id: "abc123",
        data: {
          name: "Galilee",
          emoji: "sun",
          ownerUid: "omer",
          destination: { label: "Galilee", lat: 32.9, lng: 35.5, region: "North" },
          startDate: "2026-11-05",
          endDate: "2026-11-07",
          timezone: "Asia/Jerusalem",
          currency: "ILS",
          coverImage: null,
          groupKind: "couple",
          ai: { name: "Gofi", emoji: "butler", preset: "butler", rules: ["short"], customRules: "", avatar: "https://firebasestorage.googleapis.com/v0/b/x/o/avatar.jpg?token=1" },
          settings: { membersCanDeletePlaces: false },
          status: "active",
          createdAt: 100,
        },
        collections: {
          members: [
            { id: "omer", data: { role: "owner", displayName: "Omer", familyId: "f-tal", memberId: "m-omer", joinedAt: 100 } },
            { id: "dana", data: { role: "admin", displayName: "Dana", familyId: "f-gone", memberId: "m-dana", joinedAt: 200 } },
            { id: "anon1", data: { role: "member", guest: true } },
          ],
          families: [{ id: "f-tal", data: { name: "Omer", members: [{ id: "m-omer", name: "Omer" }] } }],
          documents: [{ id: "d1", data: { ownerUid: "dana", ownerName: "Dana", visibility: "private", storagePath: "trips/abc123/documents/private/dana/1-pass.pdf", name: "pass.pdf", size: 10 } }],
          usage: [{ id: "2026-11", data: { aiCalls: 3 } }, { id: "junk", data: {} }],
        },
      },
    ],
  };
}

const plan = () => transform(fixture(), { siteUrl: "https://together.app", legacyOwnerUid: "omer" });

describe("users", () => {
  it("maps Google identities to provider accounts by the provider's own id", () => {
    const omer = plan().users.find((user) => user.firebaseUid === "omer")!;
    expect(omer.accounts).toEqual([{ providerId: "google", accountId: "g-omer" }]);
    expect(omer.name).toBe("Omer Tal");
    expect(omer.email).toBe("omer@example.com");
  });

  it("creates placeholders only for kid/shared identities that authored something", () => {
    const users = plan().users;
    const noa = users.find((user) => user.firebaseUid === "member-noa");
    expect(noa?.accounts).toEqual([]);
    expect(noa?.email).toBeUndefined();
    // anon1 voted for a missing option and is a guest seat: never referenced → no row
    expect(users.find((user) => user.firebaseUid === "anon1")).toBeUndefined();
  });
});

describe("trips", () => {
  it("rebuilds the legacy trip from its static config with the hand-written persona", () => {
    const sicily = plan().trips.find((trip) => trip.firebaseId === "sicily-2026")!;
    expect(sicily.legacyKey).toBe("sicily");
    expect(sicily.ownerFirebaseUid).toBe("omer");
    expect(sicily.coverImage).toBe("https://together.app/images/hero.jpg");
    expect(sicily.ai.customPrompt).toContain("המשרת של חבורת מיחא");
    expect(sicily.aboutUs).toBe("ארבע משפחות");
    expect(JSON.stringify(sicily)).not.toContain("secret"); // join code never migrates
  });

  it("keeps self-serve settings and turns an uploaded avatar into a file to copy", () => {
    const trip = plan().trips.find((t) => t.firebaseId === "abc123")!;
    expect(trip.membersCanDeletePlaces).toBe(false);
    expect(trip.groupKind).toBe("couple");
    expect(trip.stops).toHaveLength(1);
    expect(trip.ai.avatar).toEqual({ kind: "file", source: { kind: "url", url: expect.stringContaining("avatar.jpg") } });
  });
});

describe("memberships", () => {
  it("migrates account seats only and drops dangling family links", () => {
    const seats = plan().memberships.filter((seat) => seat.tripFid === "abc123");
    expect(seats.map((seat) => [seat.userFid, seat.role])).toEqual([
      ["omer", "owner"],
      ["dana", "admin"],
    ]);
    const dana = seats.find((seat) => seat.userFid === "dana")!;
    expect(dana.familyKey).toBeNull();
    expect(dana.memberKey).toBeNull();
  });

  it("legacy trips get seats from per-trip profiles; kid tokens are reported", () => {
    const p = plan();
    const sicily = p.memberships.filter((seat) => seat.tripFid === "sicily-2026");
    expect(sicily.map((seat) => seat.userFid)).toEqual(["omer"]);
    expect(sicily[0]).toMatchObject({ role: "owner", familyKey: "tal", memberKey: "omer" });
    expect(p.warnings).toContainEqual({ kind: "seat_not_migrated", path: "trips/sicily-2026/members/member-noa", detail: "kid" });
  });
});

describe("content", () => {
  it("defaults unknown categories and skips nameless places", () => {
    const places = plan().places.filter((place) => place.tripFid === "sicily-2026");
    expect(places.map((place) => [place.firebaseId, place.category])).toEqual([
      ["villa", "accommodation"],
      ["weird", "other"],
    ]);
    expect(places[0].creatorFid).toBe("omer");
  });

  it("keeps valid family participants, the place link and the sent reminder", () => {
    const p = plan();
    expect(p.events).toHaveLength(1);
    expect(p.events[0]).toMatchObject({
      placeFid: "villa",
      participants: { type: "families", familyKeys: ["tal"] },
      reminderSentAt: 123,
    });
    expect(p.warnings.some((w) => w.kind === "invalid_event")).toBe(true);
  });

  it("skips expenses whose payer family doesn't exist", () => {
    expect(plan().expenses.map((expense) => expense.firebaseId)).toEqual(["x1"]);
  });

  it("converts the votes map, including legacy bare-string votes", () => {
    const poll = plan().polls[0];
    expect(poll.pinned).toBe(true);
    expect(poll.options[0].placeFid).toBe("villa");
    expect(poll.votes).toEqual([
      { userFid: "omer", optionId: "o1", name: "Omer" },
      { userFid: "member-noa", optionId: "o1", name: "" },
    ]);
  });

  it("queues document and chat photo files for copying", () => {
    const p = plan();
    expect(p.documents[0].source).toEqual({ kind: "path", path: "trips/abc123/documents/private/dana/1-pass.pdf" });
    expect(p.documents[0].visibility).toBe("private");
    const [first, second] = p.chats[0].messages;
    expect(first.image?.kind).toBe("url");
    expect(second.candidates?.[0].savedPlaceFid).toBe("villa");
  });

  it("migrates invites of migrated trips only, and month usage rows", () => {
    const p = plan();
    expect(p.invites.map((invite) => [invite.code, invite.familyKey])).toEqual([["code1234", "f-tal"]]);
    expect(p.usage).toEqual([{ tripFid: "abc123", month: "2026-11", aiCalls: 3, bookingImports: 0 }]);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(plan())).toBe(JSON.stringify(plan()));
  });
});
