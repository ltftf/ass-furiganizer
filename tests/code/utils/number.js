import test from "node:test";
import assert from "node:assert";
import { round } from "../../../src/utils/number.js";

test("round()", () => {
  assert.strictEqual(round(0), 0);
  assert.strictEqual(round(1), 1);
  assert.strictEqual(round(1.53), 1.5);
  assert.strictEqual(round(1.88), 1.9);
  assert.strictEqual(round(2.33333333), 2.3);
  assert.strictEqual(round(-10.59), -10.6);
});