import { Dialogue as SrtDialogue } from "@ltftf/srt-parser-2";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import MecabAnalyzer from "kuroshiro-analyzer-mecab";
import { Dialogue, Line } from "./types.js";
import { NodeType, parse } from "node-html-parser";
import { secondsToTime } from "./time.js";

let _kuroshiro: any;
try {
  _kuroshiro = new Kuroshiro.default();
} catch {
  _kuroshiro = new Kuroshiro();
}

let _analyzer: string;
let _inited = false;

export function setAnalyzer(analyzer: string) {
  _analyzer = analyzer;
}

export async function furiganize(srt: SrtDialogue[]): Promise<Dialogue[]> {
  if (!_inited) {
    await _kuroshiro.init(
      _analyzer === "mecab" ? new MecabAnalyzer() : new KuromojiAnalyzer()
    );
    _inited = true;
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
      position: srtBlock.position,
    };
    for (const srtLine of srtBlock.lines) {
      const line: Line = [];
      const result = await _kuroshiro.convert(srtLine, {
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
