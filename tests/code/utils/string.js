import test from "node:test";
import assert from "node:assert";
import {
  setExtension,
  getUnicodeDecimal,
  getUnicodeHex,
  getChar,
  removeDuplicates,
  escapeQuotes,
} from "../../../src/utils/string.js";


test("setExtension()", () => {
  assert.strictEqual(setExtension("file.txt", "json"), "file.json");
  assert.strictEqual(setExtension("file", "json"), "file.json");
  assert.strictEqual(setExtension("/file", "json"), "/file.json");
  assert.strictEqual(setExtension("/file.txt", "json"), "/file.json");
  assert.strictEqual(setExtension("./file", "json"), "./file.json");
  assert.strictEqual(setExtension("./file.txt", "json"), "./file.json");
  assert.strictEqual(setExtension("/folder/file", "json"), "/folder/file.json");
  assert.strictEqual(setExtension("/folder/file.txt", "json"), "/folder/file.json");
  assert.strictEqual(setExtension("/folder/file.txt"), "/folder/file");
  assert.strictEqual(setExtension("./file.json"), "./file");
});

test("unicode", () => {
  assert.strictEqual(getUnicodeDecimal("0"), 48);
  assert.strictEqual(getUnicodeDecimal("A"), 65);
  assert.strictEqual(getUnicodeHex("A"), "U+0041");
  assert.strictEqual(getUnicodeHex("😀"), "U+1F600");
  assert.strictEqual(getChar(65), "A");
  assert.strictEqual(getChar(128512), "😀");
});

test("removeDuplicates()", () => {
  for (const [charset, expected] of [
    ["a", "a"],
    ["asdfghjkl", "asdfghjkl"],
    ["aa", "a"],
    ["aaaaaaaaaaaaa", "a"],
    ["aaabc", "abc"],
    ["abccc", "abc"],
    ["abbbc", "abc"],
    ["aaabbbccc", "abc"],
    ["qwertyuioprqyqewuyrqtwerteytqrweuryqoiweuyrqoieuyr", "qwertyuiop"],
  ]) {
    assert.strictEqual(removeDuplicates(charset), expected);
  }
});

test("escapeQuotes()", () => {
  assert.strictEqual(escapeQuotes('"'), '\\"');
  assert.strictEqual(escapeQuotes('"a"b"c"'), '\\"a\\"b\\"c\\"');
});