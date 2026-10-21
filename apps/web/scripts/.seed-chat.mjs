import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
const c = new ConvexHttpClient(process.env.CONVEX_URL); c.setAuth(process.env.AUTH_TOKEN);
const tripId = process.env.TRIP;
const { sessionId, replyId } = await c.mutation(anyApi.chat.send, { tripId, text: "It might rain on Thursday. Give me three quick indoor ideas near the British Museum.", locale: "en" });
for (let i = 0; i < 150; i++) {
  const m = (await c.query(anyApi.chat.messages, { tripId, sessionId })).find((x) => x._id === replyId);
  if (m && m.status !== "pending") { console.log(m.status, (m.content || "").slice(0, 200), (m.candidates || []).length); break; }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("SESSION", sessionId);
