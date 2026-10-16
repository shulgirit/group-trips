import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Web goes through the Next.js proxy (same origin); CORS stays on for Expo Web
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
