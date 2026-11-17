import { describe, test } from "node:test";
import assert from "node:assert";
import { setDialoguesShift, secondsToTime, timeToSeconds } from '../../src/time.js'

describe("secondsToTime()", () => {
  for (const [seconds, result] of [
    [0.1, "0:00:00.10"],
    [0.100, "0:00:00.10"],
    [0.120, "0:00:00.12"],
    [0.121, "0:00:00.12"],
    [0.124, "0:00:00.12"],
    [0.125, "0:00:00.13"],
    [0.128, "0:00:00.13"],
    [0.07, "0:00:00.07"],
    [0.007, "0:00:00.01"],
    [1.50, "0:00:01.50"],
    [38.99, "0:00:38.99"],
    [38.999, "0:00:39.00"],
    [60, "0:01:00.00"],
    [70.10, "0:01:10.10"],
    [3600, "1:00:00.00"],
    [3600 * 24, "24:00:00.00"],
    [3600 * 48, "48:00:00.00"],
    [3600 * 5 + 45 * 60 + 31.75, "5:45:31.75"],
    [0, "0:00:00.00"],
    [-1, ""],
  ]) {
    test(`${seconds} seconds should turn to ${result}`, () => {
      assert.strictEqual(secondsToTime(seconds), result);
    });
  }
  for (const [seconds, shift, result] of [
    [0.1, 0.1, "0:00:00.20"],
    [60, 0, "0:01:00.00"],
    [60, 1, "0:01:01.00"],
    [60, 1.859, "0:01:01.86"],
    [60, 70, "0:02:10.00"],
    [60, -1, "0:00:59.00"],
    [60, -1.5, "0:00:58.50"],
    [60, -1.99, "0:00:58.01"],
    [60, -1.999, "0:00:58.00"],
    [60, -60, "0:00:00.00"],
    [60, -70, ""],
  ]) {
    test(`${seconds} seconds shifted by ${shift} should turn to ${result}`, () => {
      setDialoguesShift(shift);
      assert.strictEqual(secondsToTime(seconds), result);
    });
  }
});

test('595 hours or more should throw an error', () => {
  assert.throws(() => secondsToTime(3600 * 596));
});

describe("timeToSeconds()", () => {
  for (const [string, result] of [
    ["0:00:00.10", 0.1],
    ["0:00:00.12", 0.12],
    ["0:00:00.07", 0.07],
    ["0:00:01.50", 1.50],
    ["0:00:38.99", 38.99],
    ["0:01:00.00", 60],
    ["0:01:10.10", 70.10],
    ["1:00:00.00", 3600],
    ["24:00:00.00", 3600 * 24],
    ["48:00:00.00", 3600 * 48],
    ["5:45:31.75", 3600 * 5 + 45 * 60 + 31.75],
    ["0:00:00.00", 0],
  ]) {
    test(`${string} should turn to ${result} seconds`, () => {
      assert.strictEqual(timeToSeconds(string), result);
    });
  }
});
