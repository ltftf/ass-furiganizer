import { Dialogue as SrtDialogue } from "@ltftf/srt-parser-2";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import MecabAnalyzer from "kuroshiro-analyzer-mecab";
import { Dialogue, Line } from "./types.js";
import { NodeType, parse } from "node-html-parser";
import { secondsToTime } from "./time.js";

let kuroshiro: any;
try {
  kuroshiro = new Kuroshiro.default();
} catch {
  kuroshiro = new Kuroshiro();
}

let analyzer: string;
let inited = false;

export function setAnalyzer(_analyzer: string) {
  analyzer = _analyzer;
}

export async function furiganize(srt: SrtDialogue[]): Promise<Dialogue[]> {
  if (!inited) {
    await kuroshiro.init(
      analyzer === "mecab" ? new MecabAnalyzer() : new KuromojiAnalyzer()
    );
    inited = true;
  }
  const dialogues: Dialogue[] = [];
  for (const srtBlock of srt) {
    let startTime = secondsToTime(srtBlock.startSeconds);
    const endTime = secondsToTime(srtBlock.endSeconds);
    if (!startTime && !endTime) {
      continue;
    }
    if (!startTime) {
      startTime = "0:00:00.00";
    }
    const dialogue: Dialogue = {
      startTime,
      endTime,
      lines: [],
      opaqueBox: "",
    };
    for (const srtLine of srtBlock.lines) {
      const line: Line = [];
      const result = await kuroshiro.convert(srtLine, {
        to: "hiragana",
        mode: "furigana",
        delimiter_start: "[furigana_start]",
        delimiter_end: "[furigana_end]",
      });
      const html = parse(result);
      for (const element of html.childNodes) {
        if (element.nodeType === NodeType.TEXT_NODE) {
          line.push({
            text: element.innerText,
            furigana: "",
            position: {
              text: { x: 0, y: 0 },
              furigana: { x: 0, y: 0 },
            },
          });
        } else if (
          element.nodeType === NodeType.ELEMENT_NODE &&
          element.rawTagName === "ruby"
        ) {
          const [, text, furigana] = element.innerText.match(
            /^(.+)\[furigana_start\](.+)\[furigana_end\]$/
          )!;
          line.push({
            text,
            furigana,
            position: {
              text: { x: 0, y: 0 },
              furigana: { x: 0, y: 0 },
            },
          });
        }
      }
      dialogue.lines.push(line);
    }
    dialogues.push(dialogue);
  }
  return dialogues;
}
