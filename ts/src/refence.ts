// After compaction a model may carry data through without its tags. The
// hook is the only writer of boundaries, so it keeps a ledger of every block
// it issued. This pass compares a summary against that ledger and puts the
// tags back where the exact content survived, and names the lines that
// survived without them where it did not.

import { verify, wrap } from "./boundary.ts";

export interface LedgerEntry {
  hash: string;
  source: string;
  content: string;
}

export interface Leak {
  hash: string;
  source: string;
  lines: string[];   // lines of the original content found bare in the summary
}

export interface RefenceResult {
  text: string;
  intact: string[];    // hashes still wrapped and verified
  refenced: string[];  // hashes whose exact content was found bare and re-wrapped
  leaked: Leak[];      // hashes whose content survived in part, without tags
  absent: string[];    // hashes with no trace in the summary
}

const MIN_LINE = 24;

export function refence(summary: string, ledger: LedgerEntry[]): RefenceResult {
  let text = summary;
  const intact: string[] = [];
  const refenced: string[] = [];
  const leaked: Leak[] = [];
  const absent: string[] = [];

  for (const entry of ledger) {
    const r = verify(text);
    if (r.blocks.some((b) => b.hash === entry.hash && b.kind === "data")) {
      intact.push(entry.hash);
      continue;
    }
    const bareAt = findBare(text, entry.content);
    if (bareAt >= 0) {
      text = text.slice(0, bareAt) + wrap(entry.content, entry.source) + text.slice(bareAt + entry.content.length);
      refenced.push(entry.hash);
      continue;
    }
    const lines = entry.content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length >= MIN_LINE)
      .filter((l) => findBare(text, l) >= 0);
    if (lines.length > 0) {
      leaked.push({ hash: entry.hash, source: entry.source, lines: [...new Set(lines)] });
    } else {
      absent.push(entry.hash);
    }
  }

  return { text, intact, refenced, leaked, absent };
}

// Index of `needle` in `text` outside any verified block, or -1.
function findBare(text: string, needle: string): number {
  if (needle.length === 0) return -1;
  const blocks = verify(text).blocks.filter((b) => b.kind === "data");
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(needle, from);
    if (at < 0) return -1;
    const inside = blocks.some((b) => at >= b.start && at < b.end);
    if (!inside) return at;
    from = at + 1;
  }
  return -1;
}
