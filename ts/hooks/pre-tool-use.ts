// PreToolUse hook, matcher "*". The one place in Claude Code where a hook can
// stop a call: exit 2 blocks the tool. It verifies every untrusted block the
// model is about to hand to a tool (a file write, a shell command, an insert).
// A missing pair or a hash that does not match means the model is passing on
// data that is not what the tool returned. The call does not happen.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { verify, type Problem } from "../src/boundary.ts";
import { hasTags } from "../src/invisible.ts";
import { logEvent, readStdinJson, stateDir, strings } from "./lib/io.ts";

const input = readStdinJson();

// A leak from the last compaction halts tool use until a human clears it.
// Nothing can block at PostCompact or SessionStart, so the block lives here.
haltIfLeaked();
const problems: Problem[] = [];
let blocks = 0;

for (const text of strings(input.tool_input)) {
  if (hasTags(text)) {
    problems.push({ rule: "invisible-chars", hash: null, detail: "Unicode Tag characters (hidden text) in the arguments" });
  }
  if (!text.includes("<untrusted-")) continue;
  const r = verify(text);
  blocks += r.blocks.length;
  problems.push(...r.problems);
}

if (problems.length === 0) {
  if (blocks > 0) logEvent(input.cwd, { event: "pre-tool-use", tool: input.tool_name, blocks, problems: 0 });
  process.exit(0);
}

const first = problems[0] as Problem;
logEvent(input.cwd, { event: "pre-tool-use-blocked", tool: input.tool_name, blocks, rule: first.rule, hash: first.hash });
process.stderr.write(
  `untrusted-boundary: call to ${input.tool_name ?? "tool"} refused. ` +
  `${first.rule}: ${first.detail}. The block the model is passing on is not what the tool returned.\n`,
);
process.exit(2);

function haltIfLeaked(): void {
  if (process.env["UNTRUSTED_BOUNDARY_ON_LEAK"] === "warn") return;
  const path = join(stateDir(input.cwd), "last-compact.json");
  if (!existsSync(path)) return;
  const report = JSON.parse(readFileSync(path, "utf8")) as { leaked?: { source: string; lines: string[] }[]; acknowledged?: boolean };
  const leaked = report.leaked ?? [];
  if (leaked.length === 0 || report.acknowledged) return;
  logEvent(input.cwd, { event: "halted-on-leak", tool: input.tool_name, leaks: leaked.length });
  process.stderr.write(
    `untrusted-boundary: tool use halted. The last compaction carried ${leaked.length} block(s) of untrusted data ` +
    `through without their boundaries, and the summary cannot be repaired from here. A human needs to read ` +
    `.claude/untrusted-boundary/last-compact.json and run \`npm run hook:ack\` in the hook folder to continue. ` +
    `First leaked line, from ${leaked[0]?.source}: ${JSON.stringify(leaked[0]?.lines[0] ?? "")}\n`,
  );
  process.exit(2);
}

