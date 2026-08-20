import { parseTOML } from "confbox";
import fs from "fs/promises";
import path from "path";
import ospath from "ospath";

const paramsStr = await fs.readFile(
  path.join(import.meta.dirname, "..", "default_config.toml"),
  { encoding: "utf8" },
);

/** @type {import("../src/types.js").ConfigParams} */
export const config_params = parseTOML(paramsStr);

export const CONFIG_NAME = "test";
export const CONFIG_PATH = path.join(
  ospath.data(),
  "ass-furiganizer",
  `${CONFIG_NAME}.toml`,
);