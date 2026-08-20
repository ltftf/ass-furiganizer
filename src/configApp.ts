#!/usr/bin/env node
import { program } from "commander";
import ospath from "ospath";
import { join } from "path";
import { PKG_NAME } from "./package.js";
import { access, constants, cp } from "fs/promises";
import { confirm } from '@inquirer/prompts';

program
  .usage("[option]")
  .description("This command is used to work with the configuration file")
  .option("-p, --path", "show config location")
  .option("-G, --generate", "create new default config")
  .helpOption(undefined, "display help");

let { path, generate } = program.parse().opts();

const DEFAULT_CONFIG = "config.toml";
const configDir = join(ospath.data(), PKG_NAME);
const configFile = join(configDir, DEFAULT_CONFIG);
const defaultConfig = join(import.meta.dirname, "..", "default_config.toml");

async function generateConfig() {
  try {
    await cp(defaultConfig, configFile, { force: true });
    console.log("Generated new config at " + configFile);
  } catch (e: any) {
    throw new Error(
      "could not generate config file at '" + configFile + "'\n" + e.message
    );
  }
}

if (generate) {
  try {
    await access(configFile, constants.F_OK);
    try {
      const overwrite = await confirm({
        message: `exists. Overwrite?`,
        default: false,
        theme: {
          prefix: `'${DEFAULT_CONFIG}'`,
          spinner: { frames: [] },
          style: {
            answer: (t: string) => t,
            message: (t: string) => t,
            defaultAnswer: (t: string) => `[${t}]`,
          },
        }
      });
      if (overwrite) {
        await generateConfig();
      } else {
        console.log("Cancelling...");
      }
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === "ExitPromptError") {
          console.log("Cancelling...");
        } else {
          console.log("error: " + e.message);
        }
      }
    }
  } catch {
    await generateConfig();
  }
} else if (path) {
  console.log(configDir);
} else {
  program.help();
}
