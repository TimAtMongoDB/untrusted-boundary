// PostCompact hook. Claude Code does not let a hook rewrite the summary, so
// this one verifies every data block inside it and writes a report. The
// SessionStart hook reads that report and tells the next context what it
// can and cannot trust.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrubSummary } from "../src/summary.ts";
import { sha256 } from "../src/boundary.ts";
import { ledgerRead, logEvent, readStdinJson, stateDir } from "./lib/io.ts";

const input = readStdinJson();
const summary = input.compact_summary ?? "";
const ledger = ledgerRead(input);
// Nothing issued this session: nothing to check, no report, no halt.
if (ledger.length === 0 && !summary.includes("<untrusted-")) process.exit(0);
const result = scrubSummary(summary, ledger, { onLeak: "report" });

const report = {
  at: new Date().toISOString(),
  trigger: input.trigger ?? null,
  summarySha256: sha256(summary),
  kept: result.kept,
  dropped: result.dropped,
  refenced: result.refenced,
  // Claude Code cannot apply the re-fenced text, so the next context gets the
  // lines themselves and is told they are data.
  refencedPreview: result.refenced.map((hash) => {
    const e = ledger.find((l) => l.hash === hash);
    return { hash, source: e?.source ?? "", lines: (e?.content ?? "").split("\n").filter((l) => l.trim()).slice(0, 8) };
  }),
  leaked: result.leaked,
  ledgerSize: ledger.length,
  // Set to true by `npm run hook:ack` once a human has read the leak. Until
  // then the PreToolUse hook refuses every tool call (unless ON_LEAK=warn).
  acknowledged: false,
};

writeFileSync(join(stateDir(input.cwd), "last-compact.json"), JSON.stringify(report, null, 2));
logEvent(input.cwd, { event: "compact", kept: result.kept.length, dropped: result.dropped.length, refenced: result.refenced.length, leaked: result.leaked.length });
