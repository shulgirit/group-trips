// DRY RUN of the multi-trip migration — prints what would be written.
// Run: gh workflow run admin.yml -f script=migrate-multitrip.mjs
import { migrate } from "./migrate-multitrip-lib.mjs";

await migrate({ apply: false });
