// The hook for your own pipeline: run it on the exact messages you are about
// to send to the model. It refuses the call if any boundary is missing, any
// block fails its hash, or a boundary string sits inside a block.

import { BoundaryError, verify, type Block, type Problem } from "./boundary.ts";

export interface Message {
  role: string;
  content: string;
}

export interface GuardReport {
  blocks: Block[];
  problems: Problem[];
}

export function inspectMessages(messages: Message[]): GuardReport {
  const blocks: Block[] = [];
  const problems: Problem[] = [];
  for (const m of messages) {
    const r = verify(m.content);
    blocks.push(...r.blocks);
    problems.push(...r.problems);
  }
  return { blocks, problems };
}

// Throws BoundaryError. Call this immediately before the model request and
// let the error propagate; do not catch it and send anyway.
export function guardModelCall(messages: Message[]): GuardReport {
  const report = inspectMessages(messages);
  if (report.problems.length > 0) {
    const p = report.problems[0] as Problem;
    throw new BoundaryError(p.rule, p.hash, `model call refused: ${p.detail}`);
  }
  return report;
}
