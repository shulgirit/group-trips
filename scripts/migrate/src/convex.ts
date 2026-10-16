import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

/**
 * Admin client for internal migration functions. The deploy key comes from
 * the Convex dashboard (Settings → Deploy keys) or `npx convex dev`'s local
 * admin key; it never leaves this machine / CI secret.
 */
export function convexAdmin(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  const key = process.env.CONVEX_DEPLOY_KEY ?? process.env.CONVEX_ADMIN_KEY;
  if (!url || !key) throw new Error("Set CONVEX_URL and CONVEX_DEPLOY_KEY (or CONVEX_ADMIN_KEY for a local backend)");
  const client = new ConvexHttpClient(url);
  // setAdminAuth is how Convex's own tooling calls internal functions; it is
  // public at runtime but marked internal in the type declarations.
  (client as unknown as { setAdminAuth(token: string): void }).setAdminAuth(key);
  return client;
}

export function args(): Map<string, string> {
  const out = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const match = /^--([\w-]+)(?:=(.*))?$/.exec(argv[i]);
    if (!match) continue;
    out.set(match[1], match[2] ?? (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true"));
  }
  return out;
}

/** Calls an internal function with the admin key (the public client types only admit public ones). */
interface AdminCalls {
  mutation(fn: unknown, args: unknown): Promise<unknown>;
  query(fn: unknown, args: unknown): Promise<unknown>;
}

export async function adminMutation<F extends FunctionReference<"mutation", "internal">>(
  client: ConvexHttpClient,
  fn: F,
  fnArgs: FunctionArgs<F>
): Promise<FunctionReturnType<F>> {
  return (await (client as unknown as AdminCalls).mutation(fn, fnArgs)) as FunctionReturnType<F>;
}

export async function adminQuery<F extends FunctionReference<"query", "internal">>(
  client: ConvexHttpClient,
  fn: F,
  fnArgs: FunctionArgs<F>
): Promise<FunctionReturnType<F>> {
  return (await (client as unknown as AdminCalls).query(fn, fnArgs)) as FunctionReturnType<F>;
}
