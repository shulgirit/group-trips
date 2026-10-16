import { createAuth } from "../auth";

// Static instance for `npx auth generate` only — never import at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = createAuth({} as any);
