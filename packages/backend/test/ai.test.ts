import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import { makeTest, tripInput, userClient } from "./setup";

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: { data?: { code?: string; detail?: string } }) => error.data?.detail ?? error.data?.code ?? String(error)
  );

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** OpenAI + Google stubs: completions are served in order; Places always finds Taormina. */
function stubNetwork(completions: unknown[]) {
  const queue = [...completions];
  const calls: string[] & { openaiBodies?: Record<string, unknown>[] } = [];
  calls.openaiBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);
      if (url.includes("api.openai.com")) {
        if (typeof init?.body === "string") calls.openaiBodies!.push(JSON.parse(init.body));
        const next = queue.shift() as { __sse?: string[] } | undefined;
        if (next?.__sse) return sseResponse(next.__sse);
        return json(next);
      }
      if (url.includes("places:searchText")) {
        return json({ places: [{ location: { latitude: 37.85, longitude: 15.29 }, formattedAddress: "Taormina, Italy" }] });
      }
      return json({});
    })
  );
  return calls;
}

/** A streamed completion: each string is one `data:` event (the SDK reads them like OpenAI's). */
function sseResponse(events: string[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}
const chunk = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model: "gpt-5.1", choices: [{ index: 0, delta, finish_reason: null }], ...extra });
const usageChunk = (prompt: number, completionTokens: number) =>
  JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 0, model: "gpt-5.1", choices: [], usage: { prompt_tokens: prompt, completion_tokens: completionTokens, total_tokens: prompt + completionTokens } });
const streamed = (events: string[]) => ({ __sse: events });

const completion = (message: Record<string, unknown>) => ({
  id: "c",
  object: "chat.completion",
  created: 0,
  model: "gpt-5.1",
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: null, ...message } }],
});

async function setup() {
  const t = makeTest();
  const owner = await userClient(t, { name: "Omer" });
  const tripId = await owner.as.mutation(api.trips.create, { input: tripInput() });
  return { t, owner, tripId };
}

beforeEach(() => {
  process.env.AI_STREAM = "0"; // most tests serve plain JSON completions; the streaming test opts in
  process.env.OPENAI_API_KEY = "test";
  process.env.GOOGLE_MAPS_SERVER_API_KEY = "test";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("chat.send", () => {
  it("is for trip members only, and stops at the monthly quota", async () => {
    const { t, owner, tripId } = await setup();
    const stranger = await userClient(t);
    expect(await code(stranger.as.mutation(api.chat.send, { tripId, text: "hi" }))).toBe("not_member");
    await t.run(async (ctx) => {
      await ctx.db.insert("usage", { tripId, month: new Date().toISOString().slice(0, 7), aiCalls: 400, bookingImports: 0 });
    });
    expect(await code(owner.as.mutation(api.chat.send, { tripId, text: "hi" }))).toBe("quota_exceeded");
  });

  it("runs the tool loop: add_place creates the place once and the reply finishes", async () => {
    vi.useFakeTimers();
    const { t, owner, tripId } = await setup();
    const addPlace = {
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "add_place", arguments: JSON.stringify({ name: "Teatro Antico", category: "attraction", query: "Teatro Antico Taormina" }) },
        },
      ],
    };
    stubNetwork([
      completion(addPlace),
      completion({ content: JSON.stringify({ reply: "Added Teatro Antico.", candidates: [] }) }),
      completion(addPlace),
      completion({ content: JSON.stringify({ reply: "It's already saved.", candidates: [] }) }),
    ]);

    const first = await owner.as.mutation(api.chat.send, { tripId, text: "Save Teatro Antico", locale: "en" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await owner.as.mutation(api.chat.send, { tripId, sessionId: first.sessionId, text: "Save it again", locale: "en" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const places = await owner.as.query(api.places.list, { tripId });
    expect(places.map((p) => p.name)).toEqual(["Teatro Antico"]);
    expect(places[0].createdByName).toContain("The Concierge");
    const messages = await owner.as.query(api.chat.messages, { tripId, sessionId: first.sessionId });
    expect(messages.map((m) => [m.role, m.status, m.content])).toEqual([
      ["user", "done", "Save Teatro Antico"],
      ["assistant", "done", "Added Teatro Antico."],
      ["user", "done", "Save it again"],
      ["assistant", "done", "It's already saved."],
    ]);
  });

  it("streams: assembles tool calls and the answer from chunks, logs tokens, ends done", async () => {
    vi.useFakeTimers();
    process.env.AI_STREAM = "1";
    const { t, owner, tripId } = await setup();
    const args = JSON.stringify({ name: "Teatro Antico", category: "attraction", query: "Teatro Antico Taormina" });
    const answer = JSON.stringify({ reply: "Added Teatro Antico — enjoy! 🎭", candidates: [] });
    const pieces = answer.match(/.{1,7}/gs) ?? [];
    stubNetwork([
      // round 1: the tool call arrives in fragments
      streamed([
        chunk({ role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "add_place", arguments: "" } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(0, 25) } }] }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: args.slice(25) } }] }),
        usageChunk(1000, 40),
      ]),
      // round 2: the structured answer, a few characters at a time
      streamed([chunk({ role: "assistant", content: "" }), ...pieces.map((piece) => chunk({ content: piece })), usageChunk(1200, 60)]),
    ]);

    const { sessionId } = await owner.as.mutation(api.chat.send, { tripId, text: "Save Teatro Antico", locale: "en" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const messages = await owner.as.query(api.chat.messages, { tripId, sessionId });
    expect(messages.map((m) => [m.role, m.status, m.content])).toEqual([
      ["user", "done", "Save Teatro Antico"],
      ["assistant", "done", "Added Teatro Antico — enjoy! 🎭"],
    ]);
    expect((await owner.as.query(api.places.list, { tripId })).map((p) => p.name)).toEqual(["Teatro Antico"]);
    const runs = await t.run((ctx) => ctx.db.query("aiRuns").collect());
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ok: true, rounds: 2, tools: ["add_place"], promptTokens: 2200, completionTokens: 100 });
  });

  it("a model that keeps searching still gets a final answer (last round is forced to answer)", async () => {
    vi.useFakeTimers();
    const { t, owner, tripId } = await setup();
    const search = (id: string) =>
      completion({ tool_calls: [{ id, type: "function", function: { name: "search_google_places", arguments: JSON.stringify({ query: "lunch Taormina" }) } }] });
    const calls = stubNetwork([search("a"), search("b"), search("c"), completion({ content: JSON.stringify({ reply: "Here is the plan.", candidates: [] }) })]);
    const { sessionId } = await owner.as.mutation(api.chat.send, { tripId, text: "Plan tomorrow", locale: "en" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [, reply] = await owner.as.query(api.chat.messages, { tripId, sessionId });
    expect([reply.status, reply.content]).toEqual(["done", "Here is the plan."]);
    const bodies = calls.openaiBodies!;
    expect(bodies).toHaveLength(4);
    expect(bodies.slice(0, 3).every((body) => body.tool_choice === undefined)).toBe(true);
    expect(bodies[3].tool_choice).toBe("none");
  });

  it("never leaves a reply pending when the model fails", async () => {
    vi.useFakeTimers();
    const { t, owner, tripId } = await setup();
    stubNetwork([completion({ content: "not json" })]);
    const { sessionId } = await owner.as.mutation(api.chat.send, { tripId, text: "hi", locale: "en" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const [, reply] = await owner.as.query(api.chat.messages, { tripId, sessionId });
    expect(reply.status).toBe("error");
    expect(reply.content).toBe("I couldn't answer this time. Try asking again");
  });

  it("chats are private to their owner", async () => {
    const { t, owner, tripId } = await setup();
    stubNetwork([]);
    const code8 = await t.run(async (ctx) => (await ctx.db.query("invites").withIndex("by_trip", (q) => q.eq("tripId", tripId)).first())!.code);
    const member = await userClient(t);
    await member.as.mutation(api.invites.redeem, { code: code8 });
    const { sessionId } = await owner.as.mutation(api.chat.send, { tripId, text: "secret plans" });
    expect(await member.as.query(api.chat.messages, { tripId, sessionId })).toEqual([]);
    expect(await code(member.as.mutation(api.chat.deleteSession, { tripId, sessionId }))).toBe("not_found");
  });
});

describe("booking import apply", () => {
  it("creates the stay, check-in/out events and the home base, without pinging the group", async () => {
    const { t, owner, tripId } = await setup();
    stubNetwork([]);
    const importId = await t.run(async (ctx) =>
      ctx.db.insert("imports", {
        tripId,
        createdBy: (await ctx.db.query("trips").first())!.ownerId,
        fileName: "villa.pdf",
        storageId: null,
        contentType: "application/pdf",
        size: 1,
        status: "review",
        items: [],
        createdAt: Date.now(),
      })
    );
    const item = {
      kind: "lodging" as const,
      title: "Hotel Villa Maria",
      startDate: "2099-08-15",
      startTime: "",
      endDate: "2099-08-24",
      endTime: "10:30",
      location: "Contrada Bocca della Carrubba",
      city: "Castellammare del Golfo",
      confirmationCode: "ABC",
      flightNumber: "",
      from: "",
      to: "",
      travelers: [],
      notes: "Pool",
    };
    const result = await owner.as.action(api.imports.apply, { tripId, importId, items: [item] });
    expect(result).toEqual({ events: 2, places: 1, homeBase: true });

    const events = await owner.as.query(api.events.list, { tripId });
    expect(events.map((e) => [e.day, e.startTime, e.emoji])).toEqual([
      ["2099-08-15", "15:00", "hotel"],
      ["2099-08-24", "10:30", "luggage"],
    ]);
    const { trip } = await owner.as.query(api.trips.get, { tripId });
    expect(trip.homeBase).toMatchObject({ name: "Hotel Villa Maria", address: "Taormina, Italy", lat: 37.85 });
    const pushes = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(pushes.filter((job) => job.name.startsWith("pushSend"))).toHaveLength(0);
    expect(await code(owner.as.action(api.imports.apply, { tripId, importId, items: [item] }))).toBe("not_found");
  });
});
