// Small helpers shared by the Claude Code hooks. No dependencies.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  tool_use_id?: string;
  source?: string;
  trigger?: string;
  compact_summary?: string;
}

export function readStdinJson(): HookInput {
  const raw = readFileSync(0, "utf8");
  return raw.trim() ? (JSON.parse(raw) as HookInput) : {};
}

export function stateDir(cwd: string | undefined): string {
  const dir = join(cwd ?? process.cwd(), ".claude", "untrusted-boundary");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function logEvent(cwd: string | undefined, event: Record<string, unknown>): void {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event });
  appendFileSync(join(stateDir(cwd), "log.jsonl"), line + "\n");
}

// The ledger: every block the hook issued in this session, with its content,
// so a compaction summary can be checked against what was actually wrapped.
// One local JSONL file per session. Swap these two functions for a store if
// several sessions ever need to share one ledger.
export interface LedgerLine { hash: string; source: string; content: string; at: string }

function ledgerPath(cwd: string | undefined, sessionId: string | undefined): string {
  const safe = (sessionId ?? "no-session").replace(/[^A-Za-z0-9_-]/g, "_");
  return join(stateDir(cwd), `ledger-${safe}.jsonl`);
}

export function ledgerAppend(input: HookInput, line: Omit<LedgerLine, "at">): void {
  appendFileSync(ledgerPath(input.cwd, input.session_id), JSON.stringify({ at: new Date().toISOString(), ...line }) + "\n");
}

export function ledgerRead(input: HookInput): LedgerLine[] {
  const path = ledgerPath(input.cwd, input.session_id);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l) as LedgerLine);
}

// MCP tool results arrive as a string, an array of content blocks, or an
// object with a content array. Pull the text out so it can be wrapped.
export function extractText(response: unknown): string {
  if (typeof response === "string") return response;
  if (Array.isArray(response)) {
    return response.map((b) => textOf(b)).filter((t) => t.length > 0).join("\n");
  }
  if (response && typeof response === "object" && "content" in response) {
    return extractText((response as { content: unknown }).content);
  }
  return JSON.stringify(response);
}

function textOf(block: unknown): string {
  if (typeof block === "string") return block;
  if (block && typeof block === "object" && "text" in block) {
    return String((block as { text: unknown }).text);
  }
  return JSON.stringify(block);
}

// Give back the same shape the tool used, with every text replaced by one block.
export function replaceText(response: unknown, text: string): unknown {
  if (typeof response === "string") return text;
  if (Array.isArray(response)) return [{ type: "text", text }];
  if (response && typeof response === "object" && "content" in response) {
    return { ...(response as object), content: [{ type: "text", text }] };
  }
  return text;
}

// Every string value inside a parsed JSON value, whatever the shape. This is
// what the verifiers walk, so a block nested three levels down in a tool
// result or a transcript line is still checked.
export function* strings(value: unknown): Generator<string> {
  if (typeof value === "string") { yield value; return; }
  if (Array.isArray(value)) { for (const v of value) yield* strings(v); return; }
  if (value && typeof value === "object") { for (const v of Object.values(value)) yield* strings(v); }
}

export function emit(json: unknown): void {
  process.stdout.write(JSON.stringify(json) + "\n");
}
