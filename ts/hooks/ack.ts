// Marks the last compaction report as read by a human, which lifts the
// PreToolUse halt. Run it from the project directory: `npm run hook:ack`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logEvent, stateDir } from "./lib/io.ts";

const cwd = process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd();
const path = join(stateDir(cwd), "last-compact.json");

if (!existsSync(path)) {
  console.log("untrusted-boundary: no compaction report to acknowledge.");
  process.exit(0);
}

const report = JSON.parse(readFileSync(path, "utf8")) as { leaked?: unknown[]; acknowledged?: boolean };
report.acknowledged = true;
writeFileSync(path, JSON.stringify(report, null, 2));
logEvent(cwd, { event: "leak-acknowledged", leaks: (report.leaked ?? []).length });
console.log(`untrusted-boundary: acknowledged ${(report.leaked ?? []).length} leaked block(s). Tool use resumes.`);
