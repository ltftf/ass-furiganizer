import { rgb as getRgb } from "d3-color";
import path from "path";
import { highlight } from "./log.js";

export class AppError extends Error {
  constructor(message: string, prefix?: string) {
    let str = "";
    if (prefix) {
      str += `[${prefix}]: `;
    }
    str += `error: ${message}`;
    super(str);
    this.name = "AppError";
  }
}

export function colorToAss(color: string): string {
  if (/^&h(?:[0-9a-f]{2}){1,4}$/i.test(color)) {
    return color.toUpperCase();
  }
  const rgb = getRgb(color);
  if (rgb && rgb.opacity === 0) {
    return "&HFFFFFFFF";
  }
  if (
    rgb &&
    Number.isInteger(rgb.r) &&
    Number.isInteger(rgb.g) &&
    Number.isInteger(rgb.b) &&
    Number.isFinite(rgb.opacity)
  ) {
    return (
      "&H" +
      [Math.round((1 - rgb.opacity) * 255), rgb.b, rgb.g, rgb.r]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  }
  throw (
    `could not parse color: ${highlight(color)}. A valid color could be: ` +
    ["white", "rgb(255,255,255)", "rgba(255,255,255,0.5)", "#ffffff",
      "#ffffff7f"].map(c => highlight(c)).join(", ")
  );
}

export function booleanToAss(value: boolean | undefined) {
  return value ? "-1" : "0";
}

export function setExtension(fileName: string, extension: string) {
  const { dir, name } = path.parse(fileName);
  return path.join(dir, `${name}.${extension}`);
}

function getUnicode(char: string) {
  return char.codePointAt(0)!;
}
export function getChar(unicode: number) {
  return String.fromCodePoint(unicode);
}
export function getUnicodeDecimal(char: string) {
  return getUnicode(char);
}
export function getUnicodeHex(char: string) {
  return `U+${getUnicode(char).toString(16).padStart(4, "0").toUpperCase()}`
}

export function round(n: number): number {
  return Math.round(n * 10) / 10;
}
