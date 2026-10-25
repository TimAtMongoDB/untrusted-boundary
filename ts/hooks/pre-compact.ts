// PreCompact hook. Walks the transcript and refuses to compact (exit 2) while
// any untrusted-data block in it fails verification. A compaction over a
// broken block is how a forged block becomes "what the model remembers".
//
// Set UNTRUSTED_BOUNDARY_PRECOMPACT=warn to log instead of block.

import { readFileSync } from "node:fs";
import { verify, type Problem } from "../src/boundary.ts";
import { ledgerRead, logEvent, readStdinJson, strings } from "./lib/io.ts";

const input = readStdinJson();
const path = input.transcript_path;
if (!path) process.exit(0);

// No block was ever issued in this session, so there is nothing to verify
// and no reason to read the transcript.
if (ledgerRead(input).length === 0) process.exit(0);

const problems: Problem[] = [];
let blocks = 0;

for (const line of readFileSync(path, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let obj: unknown;
  try { obj = JSON.parse(line); } catch { continue; }
  for (const text of strings(obj)) {
    if (!text.includes("<untrusted-")) continue;
    const r = verify(text);
    blocks += r.blocks.length;
    problems.push(...r.problems);
  }
}

logEvent(input.cwd, { event: "pre-compact", blocks, problems: problems.length });

if (problems.length > 0 && process.env["UNTRUSTED_BOUNDARY_PRECOMPACT"] !== "warn") {
  const first = problems[0] as Problem;
  process.stderr.write(
    `untrusted-boundary: refusing to compact, ${problems.length} block(s) fail verification. ` +
    `First: ${first.rule} (${first.detail})\n`,
  );
  process.exit(2);
}

