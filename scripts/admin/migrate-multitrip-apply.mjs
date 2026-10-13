// APPLIES the multi-trip migration (idempotent — safe to re-run).
// Run the dry run first: gh workflow run admin.yml -f script=migrate-multitrip.mjs
import { migrate } from "./migrate-multitrip-lib.mjs";

await migrate({ apply: true });
