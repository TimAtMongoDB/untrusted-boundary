import { test } from "node:test";
import assert from "node:assert/strict";
import { scanInvisible, hasTags } from "../src/invisible.ts";
import { verify, wrapDetailed } from "../src/boundary.ts";

// "hi" spelled with Unicode Tag characters: U+E0068 U+E0069, invisible to a human.
const smuggled = "status: active\u{E0068}\u{E0069} ok";
const bidi = "price: \u202E001\u202C USD";
const emoji = "family: \u{1F468}\u200D\u{1F469}\u200D\u{1F467}";

test("Unicode Tag characters are detected and stripped", () => {
  const r = scanInvisible(smuggled);
  assert.equal(r.tags, 2);
  assert.equal(r.text, "status: active ok");
  assert.equal(hasTags(smuggled), true);
  assert.equal(hasTags(r.text), false);
});

test("bidi controls are stripped, zero-width joiners in emoji are kept", () => {
  assert.equal(scanInvisible(bidi).text, "price: 001 USD");
  const e = scanInvisible(emoji);
  assert.equal(e.text, emoji);
  assert.equal(e.joiners, 2);
  assert.equal(e.stripped, 0);
});

test("wrap strips before hashing and says so in the note", () => {
  const w = wrapDetailed(smuggled, "find");
  assert.equal(w.invisible, 2);
  assert.equal(w.content, "status: active ok");
  assert.ok(w.text.includes("2 Unicode Tag character(s), which encode hidden text"));
  assert.equal(verify(w.text).ok, true);
});
