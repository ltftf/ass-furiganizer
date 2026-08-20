import { describe, expect, test } from 'vitest'
import { 
  booleanToAss, 
  colorToAss, 
  round, 
  setExtension, 
  getUnicodeDecimal, 
  getUnicodeHex, 
  getChar 
} from '../../src/utils.js'

describe("colorToAss", () => {
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
  test.for([
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
  ] as [string, string][])("%s should convert to %s", ([input, result]) => {
    expect(colorToAss(input)).toBe(result);
  });

  test.for([
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
  ] as string[])("%s should throw an error", (input) => {
    expect(() => colorToAss(input)).toThrow();
  });
});

test("booleanToAss", () => {
  expect(booleanToAss(true)).toBe("-1");
  expect(booleanToAss(false)).toBe("0");
});

test("setExtension", () => {
  expect(setExtension("file.txt", "json")).toBe("file.json");
  expect(setExtension("file", "json")).toBe("file.json");
  expect(setExtension("/file", "json")).toBe("/file.json");
  expect(setExtension("/file.txt", "json")).toBe("/file.json");
  expect(setExtension("./file", "json")).toBe("file.json");
  expect(setExtension("./file.txt", "json")).toBe("file.json");
  expect(setExtension("/folder/file", "json")).toBe("/folder/file.json");
  expect(setExtension("/folder/file.txt", "json")).toBe("/folder/file.json");
});

test("unicode", () => {
  expect(getUnicodeDecimal("0")).toBe(48);
  expect(getUnicodeDecimal("A")).toBe(65);
  expect(getUnicodeHex("A")).toBe("U+0041");
  expect(getUnicodeHex("😀")).toBe("U+1F600");
  expect(getChar(65)).toBe("A");
  expect(getChar(128512)).toBe("😀");
});

test("round", () => {
  expect(round(0)).toBe(0);
  expect(round(1)).toBe(1);
  expect(round(1.53)).toBe(1.5);
  expect(round(1.88)).toBe(1.9);
  expect(round(2.33333333)).toBe(2.3);
  expect(round(-10.59)).toBe(-10.6);
});