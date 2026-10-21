import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
const c = new ConvexHttpClient(process.env.CONVEX_URL); c.setAuth(process.env.AUTH_TOKEN);
await c.mutation(anyApi.chat.deleteSession, { tripId: process.env.TRIP, sessionId: process.env.SESSION });
console.log("deleted");
