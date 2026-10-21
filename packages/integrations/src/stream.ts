/**
 * Streaming helpers for the guide's structured answer. The model returns JSON like
 * {"reply":"…","candidates":[…]}; `reply` comes first, so while the JSON is still arriving
 * we can show the reply text as it is written.
 */

const SIMPLE_ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "/": "/", "\\": "\\", '"': '"' };

/**
 * The text of the "reply" field from a possibly incomplete JSON document.
 * Returns what is decodable so far ("" until the field starts); never throws and
 * never returns half of an escape sequence.
 */
export function extractReply(partial: string): string {
  const start = /"reply"\s*:\s*"/.exec(partial);
  if (!start) return "";
  let out = "";
  let i = start.index + start[0].length;
  while (i < partial.length) {
    const ch = partial[i];
    if (ch === '"') return out; // the string is closed
    if (ch === "\\") {
      const next = partial[i + 1];
      if (next === undefined) return out; // escape cut in half
      if (next === "u") {
        const hex = partial.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return out; // \uXXXX not complete yet
        out += String.fromCharCode(Number.parseInt(hex, 16));
        i += 6;
        continue;
      }
      out += SIMPLE_ESCAPES[next] ?? next;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
