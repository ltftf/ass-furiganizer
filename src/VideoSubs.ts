import { fromSrt } from "@ltftf/srt-parser-2";
import { Blueprint, BpChunk, BpLine, ConfigParams, Dialogue, Line } from "./types.js";
import { furiganize } from "./kuroshiro.js";
import { readFile } from "fs/promises";
import json5 from "json5";
import { EOL } from "os";
import { processAssTime, timeToSeconds } from "./time.js";
import { checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import { warning } from "./log.js";

export class VideoSubs {
  public dialogues: Dialogue[] = [];
  public params!: ConfigParams;

  public getInstanesByPosition() {
    const instances: VideoSubs[] = [];
    const positions: number[] = [this.params.positioning.position];
    for (const dialogue of this.dialogues) {
      if (dialogue.position && !positions.includes(dialogue.position)) {
        positions.push(dialogue.position);
      }
    }
    for (const position of positions) {
      const instance = new VideoSubs();
      for (const dialogue of this.dialogues) {
        if (
          !dialogue.position && position === this.params.positioning.position ||
          dialogue.position === position
        ) {
          instance.dialogues.push(dialogue);
        }
      }
      const params = structuredClone(this.params);
      params.positioning.position = position;
      instance.params = params;
      instances.push(instance);
    }
    return instances;
  }


  public async createFromInputFile(
    inputFile: string,
    params: ConfigParams,
    interactive: boolean
  ) {
    this.params = params;
    const data = await readFile(inputFile, { encoding: "utf-8" });
    if (inputFile.endsWith(".srt")) {
      const parsedSrt = fromSrt(data);
      if (!parsedSrt.length) {
        throw "found no subtitles in the SRT file";
      }
      for (const dialogue of parsedSrt) {
        const lines = dialogue.lines;
        for (let i = 0; i < lines.length; i++) {
          lines[i] = lines[i].replace(/<\/?(?:b|i|u|font[^>]*)>/g, "");
          for (const [find, replace] of params.substitute.text) {
            if (find.startsWith("U+")) {
              lines[i] = lines[i].replace(
                new RegExp(`\\u{${find.replace("U+", "")}}`, "ug"), replace
              );
            } else {
              lines[i] = lines[i].replace(new RegExp(find, "g"), replace);
            }
          }
        }
      }
      for (let d = parsedSrt.length - 1; d >= 0; d--) {
        const lines = parsedSrt[d].lines;
        for (let l = lines.length - 1; l >= 0; l--) {
          lines[l] = lines[l].trim();
          if (!lines[l]) {
            lines.splice(l, 1);
          }
        }
        if (!lines.length) {
          parsedSrt.splice(d, 1);
        }
      }
      if (!parsedSrt.length) {
        throw "no subtitles to process";
      }

      this.dialogues = await furiganize(parsedSrt);

      const useInlineFurigana: { message: string, callback: () => void }[] = [];
      for (let di = 0; di < this.dialogues.length; di++) {
        const dialogue = this.dialogues[di];
        for (const line of dialogue.lines) {
          for (let ci = 0; ci < line.length; ci++) {
            const chunk = line[ci];
            chunk.furigana = chunk.furigana.trim();
            for (const [find, replace] of params.substitute.furigana) {
              if (chunk.furigana && chunk.furigana === find) {
                chunk.furigana = replace;
              }
            }
            if (ci < line.length - 1) {
              const furigana = chunk.furigana;
              if (furigana) {
                const chunkNext = line[ci + 1];
                if (params.miscellaneous.remove_inline_furigana) {
                  chunkNext.text = chunkNext.text.replace(
                    new RegExp(`^\\s*[(（]\\s*${furigana}\\s*[)）]`),
                    ""
                  );
                }
                if (params.miscellaneous.use_inline_furigana) {
                  const inlineFurigana = chunkNext.text.match(/^[(（]([^)）]+)[)）]/);
                  if (inlineFurigana) {
                    useInlineFurigana.push({
                      message: line
                        .map(chunk => chunk.text)
                        .join("")
                        .replace(
                          chunk.text + inlineFurigana[0],
                          chalk.level ? chalk.red("$&") : " < $& > "
                        ),
                      callback: () => {
                        chunk.furigana = inlineFurigana[1];
                        chunkNext.text = chunkNext.text.replace(
                          inlineFurigana[0],
                          ""
                        )
                      }
                    });
                  }
                }
              }
            }
          }
        }
        if (di < this.dialogues.length - 1) {
          const dialogueNext = this.dialogues[di + 1];
          if (
            timeToSeconds(dialogueNext.startTime) <
            timeToSeconds(dialogue.endTime)
          ) {
            if ([4, 5, 6].includes(params.positioning.position)) {
              throw (
                `found dialogue overlap at dialogue ${di + 2}. Can't handle ` +
                "overlapping when the subtitles are centered vertically. Use any " +
                "'position' other than 4, 5 or 6 with 'shift' instead"
              );
            }
            if (params.styles.opaque_box?.enable) {
              throw (
                `found dialogue overlap at dialogue ${di + 2}. Can't draw ` +
                "opaque box with overlapping dialogues"
              );
            }
          }
        }
      }
      if (useInlineFurigana.length) {
        if (interactive) {
          const callbacks = await checkbox({
            message: "use_inline_furigana: Select furigana to use. Unselected will remain as is",
            choices: useInlineFurigana.map(({ message, callback }) => ({
              name: message,
              value: callback,
            })),
            prefix: "",
            theme: {
              icon: {
                cursor: ">",
                checked: " ◉ ",
                unchecked: " ◯ ",
              },
              prefix: "",
              style: {
                highlight: (t: string) => chalk.dim(t),
                answer: () => "",
              },
            },
            shortcuts: { invert: null }
          });
          for (const cb of callbacks) {
            cb();
          }
        } else {
          warning("use_inline_furigana: interactivity is off. Skipping...");
        }
      }
    } else {
      let split = data.split(
        /Dialogue \d+ \((\d{1,3}:\d{2}:\d{2}\.\d{2} - \d{1,3}:\d{2}:\d{2}\.\d{2})\)(?: \[position: (\d)\])?:/
      );
      const leadingText = split[0];
      const incorrectFormatting = (line: number) => `incorrect formatting at line ${line}`;
      if (leadingText.trim()) {
        const lineCount = (str: string) => str.split(/\r?\n/).length;
        throw incorrectFormatting(lineCount(leadingText) - lineCount(leadingText.trimStart()) + 1);
      }
      split = split.slice(1);
      let json = "{";
      for (let i = 0; i < split.length; i += 3) {
        const time = split[i];
        const position = split[i + 1];
        const data = split[i + 2];
        let dialogueKey = time;
        if (position && position !== "0") {
          dialogueKey += " - " + position;
        }
        json += "'" + dialogueKey + "':";
        json += "[" + data + "],";
      }
      json += "}";
      let subs: Blueprint;
      try {
        subs = json5.parse(json);
      } catch (e: any) {
        if (e.lineNumber) {
          throw incorrectFormatting(e.lineNumber);
        } else {
          throw e.message;
        }
      }
      const keys = Object.keys(subs);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const [startTime, endTime, position] = key.split(" - ");
        const dialogue: Dialogue = {
          startTime: processAssTime(startTime),
          endTime: processAssTime(endTime),
          lines: [],
          opaqueBox: "",
          position: position ? parseInt(position) : undefined,
        }
        const lines = subs[key];
        if (
          !lines ||
          !Array.isArray(lines) ||
          !lines.length ||
          !lines.every(line => Array.isArray(line) && line.length && line.every(chunk => {
            if (typeof chunk !== "object" || chunk === null || Array.isArray(chunk)) {
              return false;
            }
            const keys = Object.keys(chunk);
            return (
              keys.length === 2 &&
              keys.includes("text") &&
              keys.includes("furigana") &&
              Object.values(chunk).every(val => typeof val === "string")
            );
          }))
        ) {
          throw (
            `Dialogue ${i + 1}: incorrect structure. Expected one or more arrays ` +
            "containing objects with a 'text': <string> and 'furigana': <string> fields"
          );
        }
        for (const line of lines) {
          const nextLine: Line = [];
          for (const chunk of line) {
            nextLine.push({
              ...chunk,
              position: {
                text: { x: 0, y: 0 },
                furigana: { x: 0, y: 0 }
              }
            });
          }
          dialogue.lines.push(nextLine);
        }
        this.dialogues.push(dialogue);
      }
    }
  }

  public generateBlueprint(): string {
    let bp = "";
    for (let i = 0; i < this.dialogues.length; i++) {
      const dialogue = this.dialogues[i];
      let dialogueHeader = `Dialogue ${i + 1} (${dialogue.startTime} - ${dialogue.endTime})`;
      if (dialogue.position) {
        dialogueHeader += ` [position: ${dialogue.position}]`;
      }
      dialogueHeader += ":";
      const lines: BpLine[] = [];
      for (const line of dialogue.lines) {
        const chunks: BpChunk[] = [];
        for (const chunk of line) {
          const { text, furigana } = chunk;
          chunks.push({ text, furigana });
        }
        lines.push(chunks);
      }
      bp += EOL + dialogueHeader + EOL;
      for (let i = 0; i < lines.length; i++) {
        bp += json5.stringify(lines[i], null, 2) + "," + EOL;
      }
    }
    bp = bp.replace(/^\s+text: '.*$/gm, " ".repeat(4) + "$&");
    return "\ufeff" + bp.trim();
  }

  public getCharset(textOnly?: boolean) {
    let chars = "";
    function appendChars(str: string): void {
      for (const char of str) {
        if (!chars.includes(char)) {
          chars += char;
        }
      }
    }
    for (const dialogue of this.dialogues) {
      const { lines } = dialogue;
      for (const line of lines) {
        for (const chunk of line) {
          appendChars(chunk.text + (textOnly ? "" : chunk.furigana));
        }
      }
    }
    return chars;
  }
}
