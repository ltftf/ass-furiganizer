import { describe, test } from "node:test";
import assert from "node:assert";
import { booleanToAss, colorToAss } from "../../../src/utils/ass.js";

describe("colorToAss()", () => {
  /**
   * .ass color format: &HAABBGGRR
   * AA - alpha (opacity reversed)
   * BB - blue
   * GG - green
   * RR - red
   * 
   * other accepted formats: 
   * &HRR
   * &HGGRR
   * &HBBGGRR
   */
  for (const [color, expected] of [
    ["&hff", "&HFF"],
    ["&hFF", "&HFF"],
    ["&hffff", "&HFFFF"],
    ["&hffffff", "&HFFFFFF"],
    ["&hffffffff", "&HFFFFFFFF"],
    ["&hBEFAC3", "&HBEFAC3"],
    ["&h01234567", "&H01234567"],
    ["&h89ABCDEF", "&H89ABCDEF"],
    ["rgb(255,255,255)", "&H00FFFFFF"],
    ["rgb(255,0,0)", "&H000000FF"],
    ["rgba(155,100,50,0)", "&HFFFFFFFF"],
    ["rgba(0,255,255,1)", "&H00FFFF00"],
    ["rgb(0,127,0)", `&H0000${(127).toString(16).toUpperCase()}00`],
    [
      "rgba(255,0,0,0.41)",
      `&H${Math.round((1 - 0.41) * 255).toString(16).toUpperCase()}0000FF`
    ],
    ["#ffeeaa", "&H00AAEEFF"],
    [
      "#ffeeaaba",
      `&H${(255 - parseInt("ba", 16)).toString(16).toUpperCase()}AAEEFF`
    ],
    ["#ffffff00", "&HFFFFFFFF"],
    ["#aaffffff", "&H00FFFFAA"],
    ["white", "&H00FFFFFF"],
    ["black", "&H00000000"],
    ["yellow", "&H0000FFFF"],
    ["blue", "&H00FF0000"],
    ["lime", "&H0000FF00"],
    ["red", "&H000000FF"],
  ]) {
    test(`${color} should convert to ${expected}`, () => assert.strictEqual(colorToAss(color), expected));
  }

  for (const invalidColor of [
    "&hf",
    "&hF",
    "&hfff",
    "&hfffff",
    "&hfffffff",
    "&hfffffffff",
    "&hffffffffff",
    "&F",
    "&",
    "a",
    "asdlfkj",
    "ab",
    "&hBEFACG",
    "&hBEFACH",
    "&hBEFACI",
    "&h70707o",
    "&hae-",
    "&hae-1",
  ]) {
    test(`${invalidColor} should throw an error`, () => assert.throws(() => colorToAss(invalidColor)));
  }
});

test("booleanToAss()", () => {
  assert.strictEqual(booleanToAss(true), "-1");
  assert.strictEqual(booleanToAss(false), "0");
});
