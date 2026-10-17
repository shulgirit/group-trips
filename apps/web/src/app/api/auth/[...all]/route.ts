import { handler } from "@/lib/auth-server";

/** Better Auth runs in Convex; this proxies it so session cookies live on our domain. */
export const { GET, POST } = handler;
