import { describe, expect, it } from "vitest";
import { extractReply } from "../src/stream";

describe("extractReply", () => {
  it("is empty until the reply field starts", () => {
    expect(extractReply("")).toBe("");
    expect(extractReply('{"rep')).toBe("");
    expect(extractReply('{"reply":')).toBe("");
  });

  it("grows with the stream and stops at the closing quote", () => {
    const json = '{"reply":"Hello there","candidates":[]}';
    expect(extractReply('{"reply":"Hel')).toBe("Hel");
    expect(extractReply('{"reply":"Hello there')).toBe("Hello there");
    expect(extractReply(json)).toBe("Hello there");
    // text after the closing quote (candidates) never leaks in
    expect(extractReply('{"reply":"Hi","candidates":[{"name":"x"}')).toBe("Hi");
  });

  it("decodes escapes and never returns half of one", () => {
    expect(extractReply('{"reply":"line1\\nline2')).toBe("line1\nline2");
    expect(extractReply('{"reply":"say \\"hi\\"')).toBe('say "hi"');
    expect(extractReply('{"reply":"cut\\')).toBe("cut");
    expect(extractReply('{"reply":"emoji \\ud83d')).toBe("emoji \ud83d"); // lone surrogate completes with the next chunk
    expect(extractReply('{"reply":"half \\u05')).toBe("half ");
    expect(extractReply('{"reply":"שלום \\u05d0')).toBe("שלום א");
  });

  it("handles whitespace in the JSON and Hebrew text", () => {
    expect(extractReply('{ "reply" : "בוקר טוב')).toBe("בוקר טוב");
  });

  it("every prefix of a real answer decodes to a prefix of the final text", () => {
    const text = 'Added "Teatro Antico" — see you at 10:00!\nבהצלחה 🎉';
    const json = JSON.stringify({ reply: text, candidates: [] });
    let previous = "";
    for (let end = 0; end <= json.length; end++) {
      const reply = extractReply(json.slice(0, end));
      expect(text.startsWith(reply) || reply.endsWith("\ud83c") || reply.endsWith("\ud83d")).toBe(true);
      expect(reply.length).toBeGreaterThanOrEqual(previous.length);
      previous = reply;
    }
    expect(extractReply(json)).toBe(text);
  });
});
