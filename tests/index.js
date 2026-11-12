import test from "node:test";
import assert from "node:assert";
import { removeDuplicates } from "../src/utils/string.ts";

test("removeDuplicates()", () => {
  for (const [charset, expected] of [
    ["a", "a"],
    ["asdfghjkl", "asdfghjkl"],
    ["aa", "a"],
    ["aaaaaaaaaaaaa", "a"],
    ["aaabc", "abc"],
    ["abccc", "abc"],
    ["abbbc", "abc"],
    ["abbbc", "abc"],
    ["qwertyuioprqyqewuyrqtwerteytqrweuryqoiweuyrqoieuyr", "qwertyuiop"],
  ]){
    assert.strictEqual(removeDuplicates(charset), expected);
  }
});