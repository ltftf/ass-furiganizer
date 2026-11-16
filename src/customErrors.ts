import { style } from "./log.js";

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