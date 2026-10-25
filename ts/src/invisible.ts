// Characters a human cannot see but a model reads. Unicode Tag characters
// can spell out an entire hidden sentence (ASCII smuggling); bidi controls
// reorder or hide text; zero-width spaces split words so filters miss them.
//
// Stripped: Tags, bidi controls, zero-width space, word joiner, BOM.
// Counted but kept: zero-width joiner and non-joiner, which emoji sequences
// and Indic scripts need.

export interface InvisibleReport {
  text: string;
  stripped: number;
  kept: number;
  tags: number;     // U+E0000..E007F, never legitimate in tool output
  bidi: number;     // U+202A..202E, U+2066..2069
  zeroWidth: number; // U+200B, U+2060, U+FEFF
  joiners: number;  // U+200C, U+200D (kept)
}

const STRIP = /[\u{E0000}-\u{E007F}\u202A-\u202E\u2066-\u2069\u200B\u2060\uFEFF]/gu;
const TAGS = /[\u{E0000}-\u{E007F}]/gu;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/g;
const ZERO = /[\u200B\u2060\uFEFF]/g;
const JOIN = /[\u200C\u200D]/g;

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

export function scanInvisible(text: string): InvisibleReport {
  const tags = count(text, TAGS);
  const bidi = count(text, BIDI);
  const zeroWidth = count(text, ZERO);
  const joiners = count(text, JOIN);
  return {
    text: text.replace(STRIP, ""),
    stripped: tags + bidi + zeroWidth,
    kept: joiners,
    tags, bidi, zeroWidth, joiners,
  };
}

export function hasTags(text: string): boolean {
  return TAGS.test(text) && ((TAGS.lastIndex = 0), true);
}

export function describeInvisible(r: InvisibleReport): string {
  const parts: string[] = [];
  if (r.tags > 0) parts.push(`${r.tags} Unicode Tag character(s), which encode hidden text`);
  if (r.bidi > 0) parts.push(`${r.bidi} bidi control(s)`);
  if (r.zeroWidth > 0) parts.push(`${r.zeroWidth} zero-width character(s)`);
  if (r.joiners > 0) parts.push(`${r.joiners} zero-width joiner(s) left in place`);
  return parts.join(", ");
}
