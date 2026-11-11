import path from "path";

export function setExtension(fileName: string, extension: string) {
  const { dir, name } = path.parse(fileName);
  return path.join(dir, `${name}.${extension}`);
}

export function escapeQuotes(str: string) {
  return str.replace(/"/g, '\\"');
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