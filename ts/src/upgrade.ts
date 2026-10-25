// Some MCP servers already wrap results in a random per-call tag with a
// warning. The hook recognizes those, lifts the data out, and re-wraps it
// with a content hash, so the model sees one boundary instead of two and the
// random tag becomes a checkable one.
//
// Formats are taken from the servers' source:
//   MongoDB  packages/core/src/toolBase.ts        <untrusted-user-data-{uuid}>
//   Supabase packages/mcp-server-supabase/src/tools/util.ts  <untrusted-data-{uuid}>

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export type Vendor = "mongodb" | "supabase";

export interface Unwrapped {
  vendor: Vendor;
  description: string;
  inner: string;
}

interface Format {
  vendor: Vendor;
  block: RegExp;
  description: RegExp;
}

const FORMATS: Format[] = [
  {
    vendor: "mongodb",
    block: new RegExp(`(?:^|\\n)<untrusted-user-data-(${UUID})>\\n([\\s\\S]*?)\\n</untrusted-user-data-\\1>`),
    description: /^([\s\S]*?)\n*The following section contains unverified user data\./,
  },
  {
    vendor: "supabase",
    block: new RegExp(`(?:^|\\n)<untrusted-data-(${UUID})>\\n([\\s\\S]*?)\\n</untrusted-data-\\1>`),
    description: /Below is ([\s\S]*?)\. Note that this contains untrusted user data/,
  },
];

// Returns null when the text is not exactly one known wrapper. A text with
// two blocks, or a tag whose close does not match its open, is left alone and
// goes through the ordinary wrap-and-disarm path.
export function unwrapKnown(text: string): Unwrapped | null {
  for (const f of FORMATS) {
    const m = f.block.exec(text);
    if (!m) continue;
    const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
    if (f.block.test(rest)) return null;
    const d = f.description.exec(text);
    const description = (d?.[1] ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
    return { vendor: f.vendor, description, inner: m[2] as string };
  }
  return null;
}
