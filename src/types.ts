/**
 * sub dialogues
 */
export interface PositionCoors {
  x: number;
  y: number;
}
export type Chunk = {
  text: string;
  furigana: string;
  position: {
    text: PositionCoors;
    furigana: PositionCoors;
  };
};
export type Line = Chunk[];
export interface Dialogue {
  startTime: string;
  endTime: string;
  lines: Line[];
  opaqueBox: string;
  position?: number;
}

/**
 * sub blueprint
 */
export type BpChunk = Omit<Chunk, "position">;
export type BpLine = BpChunk[];
export type BpDialogue = BpLine[];
export interface Blueprint {
  [time: string]: BpDialogue;
}

/**
 * config params
 */
export interface StyleParams {
  fontsize: number;
  bold: boolean | undefined;
  italic: boolean | undefined;
  outline: number;
  shadow: number;
  color: string;
  outline_color: string;
  shadow_color: string;
}
export type Substitute = {
  text: [string, string][];
  furigana: [string, string][];
};
export type AxesArray = [number, number];
export interface ConfigParams {
  positioning: {
    position: number;
    align: "start" | "center" | "end" | "auto";
    furigana_offset: number;
    line_distance: number;
    margin: number;
    shift: AxesArray | undefined,
  },
  styles: {
    text: StyleParams;
    furigana: StyleParams & { scale_factor: number | undefined };
    opaque_box: {
      enable: boolean;
      padding: number | AxesArray;
      outline: number;
      shadow: number;
      border_radius: number;
      color: string;
      outline_color: string;
      shadow_color: string;
    } | undefined;
    blur: {
      text: number | undefined;
      furigana: number | undefined;
      opaque_box: number | undefined;
    } | undefined;
    shadow_direction: {
      text: AxesArray | undefined;
      furigana: AxesArray | undefined;
      opaque_box: AxesArray | undefined;
    } | undefined;
    font_path: string | undefined;
    consistent_font_size: boolean | undefined;
  };
  miscellaneous: {
    output_dir: string | undefined;
    analyzer: "kuromoji" | "mecab";
    remove_inline_furigana: boolean;
    use_inline_furigana: boolean | undefined;
    add_suffix: boolean | undefined;
    suffix: string | undefined;
    interactive: boolean;
  };
  substitute: Substitute;
}

/**
 * cli params
 */
export interface CliParams {
  inputSubs: string[],
  inputVideos: string[],
  configName: string | undefined,
  fontPath: string | undefined,
  shiftTime: number | undefined,
  generateBlueprint: boolean | undefined,
  ignoreOutputDir: boolean,
  printAllChars: boolean,
  embedFont: boolean,
  resolution: string | undefined,
  outputFileName: string | undefined,
  oneSrtFile: boolean,
}

/**
 * other
 */
export interface VerticalPadding {
  top: number;
  bottom: number;
}
export interface VariationAxes {
  [tag: string]: number
}
export type VideoData = [number, number, string];

// https://stackoverflow.com/questions/47057649/typescript-string-dot-notation-of-nested-object
type PathsToStringProps<T> = T extends (string | number | boolean) ? [] : {
  [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>]
}[Extract<keyof T, string>];
type Join<T extends string[], D extends string> =
  T extends [] ? never :
  T extends [infer F] ? F :
  T extends [infer F, ...infer R] ?
  F extends string ?
  `${F}${D}${Join<Extract<R, string[]>, D>}` : never : string;
export type Param = Join<PathsToStringProps<ConfigParams>, ".">