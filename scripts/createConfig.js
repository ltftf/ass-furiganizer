import { cp, access, constants } from "fs/promises";
import ospath from "ospath";
import { join } from "path";

const configSrc = join(import.meta.dirname, "..", "default_config.toml");
const configDest = join(ospath.data(), "ass-furiganizer", "config.toml");

try {
  await access(configDest, constants.F_OK);
} catch {
  try {
    await cp(configSrc, configDest);
  } catch (e) {
    throw new Error(
      `could not create config file at '${configDest}': ${e.message}`
    );
  }
}
