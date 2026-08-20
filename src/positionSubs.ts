import { Font } from "fontkit";
import {
  Chunk,
  ConfigParams,
  Dialogue,
  Line,
  PositionCoors,
  VerticalPadding
} from "./types.js";
import { VideoSubs } from "./VideoSubs.js";
import { timeToSeconds } from "./time.js";

function verifyMetricValue(value: number, allowInfinity?: boolean) {
  if (typeof value !== "number" || (!allowInfinity && !Number.isFinite(value))) {
    throw "could not determine some of the font metrics";
  }
  return value;
}

export function positionSubs(
  subs: VideoSubs,
  font: Font,
  configParams: ConfigParams,
  resX: number,
  resY: number,
) {
  const params = configParams.positioning;
  const styles = configParams.styles;

  const ascent = verifyMetricValue(
    Number.isFinite(font["OS/2"].winAscent)
      ? font["OS/2"].winAscent
      : font.ascent
  );
  const descent = verifyMetricValue(
    Number.isFinite(font["OS/2"].winDescent)
      ? -font["OS/2"].winDescent
      : font.descent
  );

  const fontMetricHeight = ascent - descent;

  /**
   * normally font size includes the top and bottom padding but those are going
   * to be stripped and handled by line_distance and furigana_offset instead,
   * so the font size will be adjusted here to match the fontsize value from the config
   */
  const charSizes: number[] = subs.getCharset().split("")
    .map(char => font.layout(char).bbox.height)
    .filter(n => Number.isFinite(n));
  if (!charSizes.length) {
    throw "could not determine some of the font metrics";
  }
  let charSizeAvg = charSizes.reduce((sum, n) => sum + n, 0) / charSizes.length;
  // exclude outliers
  const deviation = (n: number) => Math.abs((n - charSizeAvg) / charSizeAvg);
  charSizes.sort((a, b) => deviation(a) - deviation(b));
  const includeValuesCount = Math.ceil(charSizes.length * 0.8);
  charSizeAvg = charSizes
    .slice(0, includeValuesCount)
    .reduce((sum, n) => sum + n, 0) / includeValuesCount;

  const percentDiff = (fontMetricHeight - charSizeAvg) / charSizeAvg;
  styles.text.fontsize *= 1 + percentDiff;
  styles.furigana.fontsize *= 1 + percentDiff;


  const textRatio = fontMetricHeight / styles.text.fontsize;
  const furiganaRatio = fontMetricHeight / styles.furigana.fontsize;


  function shiftChunk(
    chunk: Chunk,
    shiftBy: number,
    axis: keyof PositionCoors
  ): void {
    chunk.position.text[axis] += shiftBy;
    if (chunk.furigana) {
      chunk.position.furigana[axis] += shiftBy;
    }
  }
  function shiftDialogue(dialogue: Dialogue, px: number, axis: keyof PositionCoors) {
    for (const line of dialogue.lines) {
      for (const chunk of line) {
        shiftChunk(chunk, px, axis);
      }
    }
  }
  function shiftAllDialogues(px: number, axis: keyof PositionCoors) {
    for (const dialogue of subs.dialogues) {
      shiftDialogue(dialogue, px, axis);
    }
  }
  function shiftTillEndOfLine(px: number, startFromChunk: Chunk, line: Line) {
    for (let i = line.indexOf(startFromChunk); i < line.length; i++) {
      shiftChunk(line[i], px, "x");
    }
  }
  function shiftLine(px: number, line: Line) {
    shiftTillEndOfLine(px, line[0], line);
  }

  function measureTextWidth(str: string, ratio: number): number {
    let width = 0;
    for (const char of str) {
      const run = font.layout(char);
      width += verifyMetricValue(run.advanceWidth) / ratio;
    }
    return width;
  }

  function lineHasFurigana(line: Line) {
    for (const chunk of line) {
      if (chunk.furigana) {
        return true;
      }
    }
    return false;
  }

  function getLinePadding(line: Line) {
    const left = verifyMetricValue(font.layout(line[0].text[0]).bbox.minX) / textRatio;

    const lastChunkText = line[line.length - 1].text;
    const lastChar = lastChunkText[lastChunkText.length - 1];
    const run = font.layout(lastChar);
    const right = (
      verifyMetricValue(run.advanceWidth) -
      verifyMetricValue(run.bbox.maxX)
    ) / textRatio;

    const text: VerticalPadding = { top: Infinity, bottom: Infinity };
    for (const chunk of line) {
      for (const char of chunk.text) {
        const top = (
          ascent - verifyMetricValue(font.layout(char).bbox.maxY, true)
        ) / textRatio;
        const bottom = (
          verifyMetricValue(font.layout(char).bbox.minY, true) - descent
        ) / textRatio;
        if (top < text.top) {
          text.top = top;
        }
        if (bottom < text.bottom) {
          text.bottom = bottom;
        }
      }
    }

    let furi: VerticalPadding | null = null;
    if (lineHasFurigana(line)) {
      furi = { top: Infinity, bottom: Infinity };
      for (const chunk of line) {
        if (chunk.furigana) {
          for (const char of chunk.furigana) {
            const top = (
              ascent - verifyMetricValue(font.layout(char).bbox.maxY, true)
            ) / furiganaRatio;
            const bottom = (
              verifyMetricValue(font.layout(char).bbox.minY, true) - descent
            ) / furiganaRatio;
            if (top < furi.top) {
              furi.top = top;
            }
            if (bottom < furi.bottom) {
              furi.bottom = bottom;
            }
          }
        }
      }
    }

    return { left, right, text, furi };
  }
  function getLineWidth(line: Line, nonPositioned?: boolean) {
    let width = 0;
    if (nonPositioned) {
      for (const chunk of line) {
        width += measureTextWidth(chunk.text, textRatio);
      }
    } else {
      const start = line[0].position.text.x;
      const lastChunk = line[line.length - 1];
      const end =
        lastChunk.position.text.x + measureTextWidth(lastChunk.text, textRatio);
      width = end - start;
    }
    const { left, right } = getLinePadding(line);
    return width - left - right;
  }
  function getWidestLine(lines: Line[]) {
    let widestLine = lines[0];
    let maxWidth = 0;
    for (const line of lines) {
      const width = getLineWidth(line);
      if (width > maxWidth) {
        maxWidth = width;
        widestLine = line;
      }
    }
    return { line: widestLine, width: maxWidth };
  }
  function getDialogueHeight(lines: Line[]): number {
    const topLine = lines[0];
    const bottomLine = lines[lines.length - 1];

    let top: number;
    const topLinePadding = getLinePadding(topLine);
    if (lineHasFurigana(topLine)) {
      top = topLine.find(chunk => chunk.furigana)!.position.furigana.y +
        topLinePadding.furi!.top;
    } else {
      top = topLine[0].position.text.y + topLinePadding.text.top;
    }

    const bottom = bottomLine[0].position.text.y +
      styles.text.fontsize -
      getLinePadding(bottomLine).text.bottom;

    return bottom - top;
  }

  /**
   * perform initial placement at the bottom left
   * corner aligned to the left border (start)
   */
  const unfinishedDialogues: { endSec: number, shift: number }[] = [];
  for (let di = 0; di < subs.dialogues.length; di++) {
    const { lines } = subs.dialogues[di];
    let yPos = resY - styles.text.fontsize - unfinishedDialogues.reduce(
      (a, b) => (
        a + (b.shift + params.line_distance) *
        ([7, 8, 9].includes(params.position) ? -1 : 1)
      ),
      0,
    );
    for (let li = lines.length - 1; li >= 0; li--) {
      const line = lines[li];
      const padding = getLinePadding(line);
      yPos += padding.text.bottom;
      let xPos = -padding.left;
      let furiganaAdded = false;
      for (const chunk of line) {
        chunk.position.text.x = xPos;
        chunk.position.text.y = yPos;
        const textWidth = measureTextWidth(chunk.text, textRatio);
        if (chunk.furigana) {
          furiganaAdded = true;
          const furiganaWidth = measureTextWidth(chunk.furigana, furiganaRatio);
          chunk.position.furigana.x = xPos + (textWidth - furiganaWidth) / 2;
          chunk.position.furigana.y = yPos - styles.furigana.fontsize -
            params.furigana_offset + padding.text.top + padding.furi!.bottom;
        }
        xPos += textWidth;
      }
      yPos -= styles.text.fontsize + params.line_distance - padding.text.top;
      if (furiganaAdded) {
        yPos -= styles.furigana.fontsize + params.furigana_offset -
          padding.furi!.bottom - padding.furi!.top;
      }

    }
    /**
     * prevent dialogue overlap
     */
    if (di < subs.dialogues.length - 1) {
      if (
        timeToSeconds(subs.dialogues[di + 1].startTime) <
        timeToSeconds(subs.dialogues[di].endTime)
      ) {
        unfinishedDialogues.push({
          endSec: timeToSeconds(subs.dialogues[di].endTime),
          shift: getDialogueHeight(subs.dialogues[di].lines),
        });
      } else {
        while (unfinishedDialogues.length) {
          if (
            unfinishedDialogues[unfinishedDialogues.length - 1].endSec <=
            timeToSeconds(subs.dialogues[di + 1].startTime)
          ) {
            unfinishedDialogues.pop();
          } else {
            break;
          }
        }
      }
    }
  }

  /**
   * prevent furigana overlap
   */
  for (const dialogue of subs.dialogues) {
    const { lines } = dialogue;
    for (const line of lines) {
      for (let r = 0; r < line.length; r++) {
        const rightChunk = line[r];
        if (r > 0 && rightChunk.furigana) {
          for (let l = r - 1; l >= 0; l--) {
            const leftChunk = line[l];
            if (leftChunk.furigana) {
              const lWidth = measureTextWidth(leftChunk.furigana, furiganaRatio);
              const furiOverlap =
                leftChunk.position.furigana.x + lWidth - rightChunk.position.furigana.x;
              if (furiOverlap > 0) {
                shiftTillEndOfLine(furiOverlap, rightChunk, line);
              }
              break;
            }
          }
        }
      }
    }
  }

  /**
   * align subs:
   * start:  all lines start where the widest line starts
   * end:    all lines end where widest line ends
   * center: lines are centered relative to the widest line
   * auto:   'center' for centered position, 'start' for left-side position,
   *         'end' for right-side position
   */
  if (params.align === "auto") {
    if ([1, 4, 7].includes(params.position)) {
      params.align = "start";
    } else if ([3, 6, 9].includes(params.position)) {
      params.align = "end";
    } else {
      params.align = "center";
    }
  }
  if (params.align !== "start") {
    for (const dialogue of subs.dialogues) {
      const { lines } = dialogue;
      const widestLine = getWidestLine(lines);
      for (const line of lines) {
        if (line !== widestLine.line) {
          const diff = widestLine.width - getLineWidth(line);
          let shiftBy = diff;
          if (params.align === "center") {
            shiftBy /= 2;
          }
          shiftLine(shiftBy, line);
        }
      }
    }
  }

  /**
   * position subs on the screen
   */
  if (params.position !== 1) {
    for (const dialogue of subs.dialogues) {
      const { lines } = dialogue;
      const { width } = getWidestLine(lines);
      const height = getDialogueHeight(lines);
      let shiftX = 0;
      let shiftY = 0;
      if ([3, 6, 9 /* by the right border */].includes(params.position)) {
        shiftX = resX - width;
      } else if (
        ![4, 7].includes(params.position)
        /* not by the left border nor right (centered horizontally) */
      ) {
        shiftX = resX / 2 - width / 2;
      }
      if ([7, 8, 9 /* by the top border */].includes(params.position)) {
        shiftY = -resY + height;
      } else if (
        ![2, 3].includes(params.position)
        /* not by the bottom border nor top (centered vertically) */
      ) {
        shiftY = -resY / 2 + height / 2;
      }
      shiftDialogue(dialogue, shiftX, "x");
      shiftDialogue(dialogue, shiftY, "y");
    }
  }

  /**
   * add margin
   */
  if (params.margin) {
    if ([1, 4, 7].includes(params.position)) {
      shiftAllDialogues(params.margin, "x");
    }
    if ([3, 6, 9].includes(params.position)) {
      shiftAllDialogues(-params.margin, "x");
    }
    if ([7, 8, 9].includes(params.position)) {
      shiftAllDialogues(params.margin, "y");
    }
    if ([1, 2, 3].includes(params.position)) {
      shiftAllDialogues(-params.margin, "y");
    }
  }

  /**
   * shift
   */
  if (params.shift) {
    const [x, y] = params.shift;
    shiftAllDialogues(x, "x");
    shiftAllDialogues(y, "y");
  }

  /**
   * generate opaque box
   */
  if (styles.opaque_box?.enable) {
    const box = styles.opaque_box;

    let paddingVertical: number, paddingHorizontal: number;
    if (typeof box.padding === "number") {
      paddingVertical = box.padding;
      paddingHorizontal = box.padding;
    } else {
      paddingVertical = box.padding[1];
      paddingHorizontal = box.padding[0];
    }

    for (const dialogue of subs.dialogues) {
      const dialogueHeight = getDialogueHeight(dialogue.lines);

      if (
        paddingVertical < -dialogueHeight / 2 ||
        paddingHorizontal < -getWidestLine(dialogue.lines) / 2
      ) {
        continue;
      }

      const topLinePadding = getLinePadding(dialogue.lines[0])
      const widestLine = getWidestLine(dialogue.lines);
      let x = widestLine.line[0].position.text.x + getLinePadding(widestLine.line).left
      let w = 0;

      for (const line of dialogue.lines) {
        for (const chunk of line) {
          if (chunk.furigana) {
            const furiX =
              chunk.position.furigana.x +
              verifyMetricValue(font.layout(chunk.furigana).bbox.minX, true) / furiganaRatio;
            if (furiX < x) {
              w += x - furiX;
              x = furiX;
            }
            break;
          }
        }
      }

      const y = Math.round(
        dialogue.lines[0].reduce((a: number, c: Chunk) => {
          let y = c.position.text.y;
          if (c.furigana) {
            y = c.position.furigana.y;
          }
          if (y < a) {
            return y;
          }
          return a;
        }, Infinity) +
        (topLinePadding.furi?.top ?? topLinePadding.text.top) -
        paddingVertical
      );
      w += widestLine.width;

      for (const line of dialogue.lines) {
        for (let i = line.length - 1; i >= 0; i--) {
          const chunk = line[i];
          if (chunk.furigana) {
            const { maxX, width } = font.layout(chunk.furigana).bbox;
            verifyMetricValue(maxX);
            verifyMetricValue(width);
            const furiEndX =
              chunk.position.furigana.x +
              width / furiganaRatio -
              (width - maxX) / furiganaRatio;
            const currentRightBorderPos = x + w;
            if (furiEndX > currentRightBorderPos) {
              w += furiEndX - currentRightBorderPos;
            }
            break;
          }
        }
      }
      x -= paddingHorizontal;
      w += paddingHorizontal * 2;
      x = Math.round(x);
      w = Math.round(w);

      const h = Math.round(dialogueHeight + paddingVertical * 2);

      if (box.border_radius > 0) {
        let r = box.border_radius;
        const maxRadius = h / 2;
        if (r > maxRadius) {
          r = maxRadius;
        }
        r = Math.round(r);
        dialogue.opaqueBox =
          `m ${x + r} ${y} ` +
          `l ${x + w - r} ${y} ` +
          `b ${x + w} ${y} ${x + w} ${y + r} ${x + w} ${y + r} ` +
          `l ${x + w} ${y + h - r} ` +
          `b ${x + w} ${y + h} ${x + w - r} ${y + h} ${x + w - r} ${y + h} ` +
          `l ${x + r} ${y + h} ` +
          `b ${x} ${y + h} ${x} ${y + h - r} ${x} ${y + h - r} ` +
          `l ${x} ${y + r} ` +
          `b ${x} ${y} ${x + r} ${y} ${x + r} ${y}`;
      } else {
        dialogue.opaqueBox =
          `m ${x} ${y} ` +
          `l ${x + w} ${y} ${x + w} ${y + h} ${x} ${y + h} ${x} ${y}`;
      }
    }
  }
}