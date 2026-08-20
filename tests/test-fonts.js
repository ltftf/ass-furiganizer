/**
 * font sources:
 * https://archive.org/download/assorted-japanese-fonts
 * https://fonts.google.com/?script=Jpan
 */
import { parseTOML, stringifyTOML } from "confbox";
import fs from "fs/promises";
import { rmSync } from "fs";
import path from "path";
import ospath from "ospath";
import { spawn, execSync } from "child_process";
import { parse, stringify } from "ass-compiler";
import { config_params, CONFIG_NAME, CONFIG_PATH } from "./getConfigParams.js";
import { openSync } from "fontkit";
import { toSrt } from "@ltftf/srt-parser-2";
import { queue } from "async";

const SKIP_TTC = true;

const assDir = path.join(import.meta.dirname, "generated-ass");
const srtDir = path.join(import.meta.dirname, "generated-srt");
const videoPath = path.join(import.meta.dirname, "videos", "fonts.mp4");

const q = queue(async function ({ fontPath, i }) {
  await generateAss(fontPath, i);
}, 6);

function generateAss(fontPath, i) {
  return new Promise((resolve, reject) => {
    const furiganize = spawn("node", [
      'index.js',
      '-i', path.join(srtDir, `${i}.srt`),
      '-v', videoPath,
      '-f', fontPath,
      '-c', CONFIG_NAME,
      '--output-file-name', `${i}.ass`,
    ], { cwd: 'bin' });
    let log = "";
    furiganize.stdout.on('data', (data) => {
      log += `stdout: ${data}`;
    });
    furiganize.stderr.on('data', (data) => {
      log += `stderr: ${data}`;
    });
    furiganize.on("exit", (code) => {
      if (code) {
        reject(log.trim());
      } else {
        resolve();
      }
    });
  })
}

await fs.rm(assDir, { recursive: true, force: true });
await fs.rm(srtDir, { recursive: true, force: true });
await fs.mkdir(assDir);
await fs.mkdir(srtDir);

/**
 * all the text of each font should be placed correctly by the lower right 
 * corner without any deviations
 */
config_params.positioning.position = 3;
config_params.positioning.align = "auto";
config_params.positioning.furigana_offset = 1;
config_params.positioning.line_distance = 1;
config_params.positioning.margin = 0;
config_params.styles.text.fontsize = 57;
config_params.styles.text.outline = 0;
config_params.styles.text.shadow = 0;
config_params.styles.furigana.fontsize = 23;
config_params.styles.furigana.outline = 0;
config_params.styles.furigana.shadow = 0;
config_params.miscellaneous.output_dir = assDir;
config_params.styles.consistent_font_size = true;
await fs.writeFile(CONFIG_PATH, stringifyTOML(config_params));

const fontPaths = [];
for (const p of [
  "google",
  "assorted",
]) {
  const _path = path.join(import.meta.dirname, "fonts-" + p);
  const fontsNames = await fs.readdir(_path);
  for (const fontName of fontsNames) {
    if (/ttc$/i.test(fontName) && SKIP_TTC) {
      continue;
    }
    fontPaths.push(path.join(_path, fontName));
  }
}
if (!fontPaths.length) {
  throw new Error("no fonts");
}
console.log(`Processing ${fontPaths.length} fonts...`);
let processedCount = 0;
for (let i = 0; i < fontPaths.length; i++) {
  const fontPath = fontPaths[i];
  const fontName = path.basename(fontPath);
  const font = openSync(fontPath);
  const srt =
    "1\n00:00:00,000 --> 00:00:00,000\n" +
    fontName + "\n" +
    "具体的な見出しを\n想定します";
  await fs.writeFile(path.join(srtDir, `${i}.srt`), srt);
  q.push({ fontPath, i }, function (err) {
    if (err) {
      console.log(++processedCount, fontPath, "FAIL");
      console.log(err);
    } else {
      console.log(++processedCount, fontPath);
    }
  });
}

await q.drain();
console.log("merging...");
const ass = parse("");
const matchFont = /fontname: [\s\S]*(?=\r?\n\r?\n)/;
let fonts = "";

const generatedFiles = await fs.readdir(assDir);
for (let i = 0; i < generatedFiles.length; i++) {
  const data = await fs.readFile(path.join(assDir, generatedFiles[i]), { encoding: "utf-8" });
  const parsed = parse(data);
  if (!Object.entries(ass.info).length) {
    ass.info = parsed.info;
    ass.styles.format = parsed.styles.format;
    ass.events.format = parsed.events.format;
  }
  for (const style of parsed.styles.style) {
    style.Name += i.toString();
    ass.styles.style.push(style);
  }
  for (const dialogue of parsed.events.dialogue) {
    dialogue.Start += i;
    dialogue.End += i + 1;
    dialogue.Style += i.toString();
    ass.events.dialogue.push(dialogue);
  }
  fonts += data.match(matchFont)[0] + "\n\n";
}

let str = stringify(ass);
str += "\n\n[Fonts]\n" + fonts;
const { dir, name } = path.parse(videoPath);
await fs.writeFile(path.join(dir, `${name}.ass`), str);

execSync(`mpv "${videoPath}" > /dev/null 2>&1 &`)