import { defineSchema } from "convex/server";
import { tables } from "./generatedSchema";

// Regenerate with: cd convex/betterAuth && npx auth@1.6.33 generate --output generatedSchema.ts
// (keep the CLI on the same minor as better-auth — 1.7 changes the schema)
const schema = defineSchema({
  ...tables,
});

export default schema;
