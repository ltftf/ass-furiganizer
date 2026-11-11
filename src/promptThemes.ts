import { style } from "./log.js";

export const selectTheme = {
  prefix: "",
  icon: { cursor: ">" },
  style: {
    answer: (t: string) => style(t, "dim"),
    message: (t: string) => style(t + ":", undefined, true),
    error: (t: string) => style(t, "red"),
    help: (t: string) => style(t, "dim"),
    highlight: (t: string) => style(t, undefined, true),
    description: (t: string) => style(t, "dim"),
    disabled: (t: string) => style(t, "strikethrough"),
    keysHelpTip: (keys: [key: string, action: string][]) => {
      return keys.map(([key, action]) => {
        return `${style(`${key} ${action}`, "dim")}`;
      }).join(style(', ', "dim"));
    },
  },
};