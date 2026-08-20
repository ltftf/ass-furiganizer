import chalk, { ChalkInstance } from "chalk"

export function style(text: string, color?: keyof ChalkInstance, bold?: boolean) {
  let style = chalk;
  if (color) {
    style = style[color] as ChalkInstance;
  }
  if (bold) {
    style = style.bold;
  }
  return style(text);
}

export function warning(message: string, prefix?: string) {
  let text = "";
  if (prefix) {
    text += `[${prefix}]: `;
  }
  text += `${style("warning", "yellow")}: ${message}`;
  console.log(text);
}
export function error(message: string, prefix?: string) {
  let text = "";
  if (prefix) {
    text += `[${prefix}]: `;
  }
  text += `error: ${message}`;
  console.log(text);
}

export function printResult(filename: string, success: boolean) {
  let result = "> [" + style(filename, "dim") + "] ";
  if (success) {
    result += style("DONE", "green", true);
  } else {
    result += style("FAIL", "red", true);
  }
  console.log(result);
}

export function highlight(text: string) {
  return chalk.bold(text);
}
