import { defineComponent } from "convex/server";

// Better Auth runs as a locally installed component so we own its schema
// (needed to import migrated Firebase users and to add indexes).
const component = defineComponent("betterAuth");

export default component;
