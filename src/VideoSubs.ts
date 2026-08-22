import { fromSrt } from "@ltftf/srt-parser-2";
import { Blueprint, BpChunk, BpLine, ConfigParams, Dialogue, Line } from "./types.js";
import { furiganize } from "./kuroshiro.js";
import { readFile } from "fs/promises";
import json5 from "json5";
import { EOL } from "os";
import { processAssTime, timeToSeconds } from "./time.js";

export class VideoSubs {
  public dialogues: Dialogue[] = [];

  public async createFromInputFile(inputFile: string, params: ConfigParams) {
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
          lines[i] = lines[i].replace(/{\\an?\d{1,2}}/g, "");
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
            if (params.miscellaneous.remove_inline_furigana && ci < line.length - 1) {
              const chunkNext = line[ci + 1];
              const furigana = chunk.furigana;
              if (furigana) {
                chunkNext.text = chunkNext.text.replace(
                  new RegExp(`^\\s*\\(\\s*${furigana}\\s*\\)`),
                  ""
                );
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
    } else {
      let split = data.split(
        /Dialogue \d+ \((\d{1,3}:\d{2}:\d{2}\.\d{2} - \d{1,3}:\d{2}:\d{2}\.\d{2})\):/
      ).slice(1);
      let json = "{";
      for (let i = 0; i < split.length; i += 2) {
        json += "'" + split[i] + "':";
        json += "[" + split[i + 1] + "],";
      }
      json += "}";
      let subs: Blueprint;
      try {
        subs = json5.parse(json);
      } catch (e: any) {
        if (e.lineNumber) {
          throw "incorrect formatting at line " + e.lineNumber;
        } else {
          throw e.message;
        }
      }
      const times = Object.keys(subs);
      for (let i = 0; i < times.length; i++) {
        const time = times[i];
        const [start, end] = time.split(" - ");
        const dialogue: Dialogue = {
          startTime: processAssTime(start),
          endTime: processAssTime(end),
          lines: [],
          opaqueBox: "",
        }
        const lines = subs[time];
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
      const dialogueHeader = `Dialogue ${i + 1} (${dialogue.startTime} - ${dialogue.endTime}):`;
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
    return bp.trim();
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
