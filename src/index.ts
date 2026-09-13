#!/usr/bin/env node
import { Option, program } from "commander";
import fs from "fs/promises";
import { basename, dirname, join, resolve, isAbsolute } from "path";
import { AppError, getChar, getUnicodeDecimal, getUnicodeHex, setExtension } from "./utils.js";
import { getVideoResolution } from "./getVideoData.js";
import { CliParams, ConfigParams, VariationAxes } from "./types.js";
import { create, Font, FontCollection } from "fontkit";
import { createFont } from 'fonteditor-core';
import { setAnalyzer } from "./kuroshiro.js";
import { processSubs } from "./positionSubs.js";
import { VideoSubs } from "./VideoSubs.js";
import { error, highlight, printResult, style, warning } from "./log.js";
import { compileAss } from "./compileAss.js";
import { number, select } from "@inquirer/prompts";
import isInteractive from "is-interactive";
import { setDialoguesShift } from "./time.js";
import { SizeCalculator } from "./SizeCalculator.js";
import ospath from "ospath";
import { parseTOML } from "confbox";
import { getTtf } from "extract-ttf";
import { verifyConfigParams } from "./verifyConfigParams.js";
import { PKG_NAME, PKG_VERSION } from "./package.js";

program
  .requiredOption("-i, --input-subs <files...>", "one or more .srt or .bp files")
  .requiredOption("-v, --input-videos <files...>", "one or more video files")
  .option(
    "-c, --config-name <name>",
    "specify custom config name (e.g., 'myconfig' for myconfig.toml). " +
    "config.toml is used by default. Run 'furiganizer-config --path' to see " +
    "the config location"
  )
  .option(
    "-f, --font-path <path>",
    "choose a custom font. This overrides 'font_path' value from the config"
  )
  .option(
    "-s, --shift-time <sec>",
    "shift all dialogues by seconds (e.g., -5.5)",
    parseFloat
  )
  .option(
    "-B, --generate-blueprint",
    "save the generated subs in a json-like format to edit the generated " +
    "furigana by hand. Saved next to the input .srt file (<name>.bp)"
  )
  .option(
    "-O, --ignore-output-dir",
    "ignore 'output_dir' value from the config if specified. The subs are saved " +
    "next to the videos by default (<video_name>.ass)"
  )
  .option(
    "-U, --print-all-chars",
    "print the entire list of the characters unsupported by the font"
  )
  .option("--no-embed-font", "do not embed the font into the generated file")
  .option(
    "--resolution <res>",
    "this resolution will be used if it can't be detected automatically from the " +
    "video. Format: <width>x<height> (e.g., '1920x1080')"
  )
  .addOption(
    new Option("--output-file-name <name>", "override output file name").hideHelp()
  )
  .addOption(
    new Option("--one-srt-file", "use single sub file for multiple videos").hideHelp()
  )
  .version(PKG_VERSION, undefined, "output the version")
  .helpOption(undefined, "display help")


try {
  let {
    inputSubs,
    inputVideos,
    configName,
    fontPath,
    shiftTime,
    generateBlueprint,
    ignoreOutputDir,
    printAllChars,
    embedFont,
    resolution,
    outputFileName,
    oneSrtFile,
  }: CliParams = program.parse().opts();

  let config_params: ConfigParams;
  let configData: string;
  const configFileName = `${configName ?? "config"}.toml`;
  const configDir = join(ospath.data(), PKG_NAME);
  const configPath = join(configDir, configFileName);
  try {
    configData = await fs.readFile(configPath, { encoding: "utf-8" });
  } catch (e: any) {
    if (e.code === "ENOENT") {
      throw new AppError(`found no '${configFileName}' at ${configDir}`);
    } else {
      throw new AppError("could not read the config file", configFileName);
    }
  }
  try {
    config_params = parseTOML(configData);
  } catch (e: any) {
    console.log(e.message);
    throw new AppError("could not parse the config file", configFileName);
  }
  verifyConfigParams(
    config_params,
    configFileName,
    parseTOML(
      (await fs.readFile(
        join(import.meta.dirname, "..", "default_config.toml"),
        { encoding: "utf-8" }
      )).replace(/^#.*$/m, "").replace(/^#/gm, "")
    )
  );


  if (inputSubs.some((s: string) => !/\.(?:srt|bp)$/.test(s))) {
    throw new AppError("--input-subs (-i): unexpected file extension")
  }
  if (!oneSrtFile && inputSubs.length !== inputVideos.length) {
    throw new AppError(
      "number of --input-subs (-i) and --input-videos (-v) files must be equal. " +
      "Got " + inputSubs.length + " sub(s) and " + inputVideos.length + " video(s)"
    );
  }
  if (outputFileName && inputSubs.length > 1) {
    throw new AppError("can't override name for multiple files");
  }
  if (typeof shiftTime === "number" && !isFinite(shiftTime)) {
    throw new AppError("--shift-time (-s): expected a number");
  }


  let outputDir: string | undefined;
  if (config_params.miscellaneous.output_dir && !ignoreOutputDir) {
    outputDir = config_params.miscellaneous.output_dir;
    if (!isAbsolute(outputDir)) {
      outputDir = join(configDir, outputDir);
    }
    try {
      await fs.access(outputDir, fs.constants.W_OK)
    } catch (e: any) {
      if (e.code === "EACCES") {
        throw new AppError(`output_dir: can't write to ${outputDir}, permission denied`, configFileName);
      } else if (e.code === "ENOENT") {
        throw new AppError(`output_dir: directory ${outputDir} does not exist`, configFileName);
      } else {
        throw e;
      }
    }
    if (!(await fs.lstat(outputDir)).isDirectory()) {
      throw new AppError(`output_dir: ${outputDir} is not a directory`, configFileName);
    }
  }
  if (!fontPath && config_params.styles.font_path) {
    fontPath = config_params.styles.font_path;
    if (!isAbsolute(fontPath)) {
      fontPath = join(configDir, fontPath);
    }
  }


  setAnalyzer(config_params.miscellaneous.analyzer);
  setDialoguesShift(shiftTime);
  const interactive = config_params.miscellaneous.interactive && isInteractive();


  const selectPromptTheme = {
    prefix: "",
    icon: { cursor: ">" },
    style: {
      answer: (t: string) => style(t, "dim"),
      message: (t: string) => style(t + ":", undefined, true),
      error: (t: string) => style(t, "red"),
      help: (t: string) => style(t, "dim"),
      highlight: (t: string) => style(t, undefined, true),
      description: (t: string) => style(t, "dim"),
      disabled: (t: string) => style(t, "strikethrough"),
      keysHelpTip: (keys: [key: string, action: string][]) => {
        return keys.map(([key, action]) => {
          return `${style(`${key} ${action}`, "dim")}`;
        }).join(style(', ', "dim"));
      },
    },
  };


  let fontBuffer!: Buffer;
  let font!: Font;
  if (fontPath) {
    try {
      fontBuffer = await fs.readFile(fontPath);
    } catch (e: any) {
      throw new AppError(`could not read font ${highlight(fontPath)}`);
    }
    let fontFile: Font | FontCollection;
    try {
      fontFile = create(fontBuffer);
    } catch (e: any) {
      throw new AppError(`could not parse font ${highlight(fontPath)}: ${e.message}`);
    }
    if (fontFile.type === "TTC") {
      let ttfIndex: number;
      if (interactive) {
        ttfIndex = await select({
          choices: fontFile.fonts.map((f, i) => {
            return {
              name: `${f.fullName} (${f.subfamilyName})`,
              value: i,
              description: f.postscriptName,
            }
          }),
          message: `Select a font from collection ${basename(fontPath)}`,
          theme: selectPromptTheme,
        })
      } else {
        warning(
          "a font collection is provided but interactivity is off. " +
          `Using the first font from the collection: ${fontFile.fonts[0].fullName}`
        );
        ttfIndex = 0;
      }
      try {
        fontBuffer = getTtf(fontBuffer, ttfIndex);
      } catch (e: any) {
        throw new AppError(
          `could not extract font from collection ${highlight(fontPath)}` +
          (e?.message ? `: ${e.message}` : ""),
          "extract-ttf"
        );
      }
      try {
        font = create(fontBuffer) as Font;
      } catch (e: any) {
        throw new AppError(`could not parse font ${highlight(fontPath)}: ${e.message}`);
      }
    } else if (fontFile.type === "TTF") {
      font = fontFile as Font;
    } else {
      throw new AppError("this font format is not supported. Supported formats: ttf, otf, ttc");
    }
  } else {
    fontBuffer = await fs.readFile(join(
      import.meta.dirname,
      "..",
      "fonts",
      "NotoSansJP",
      "NotoSansJP-Medium.ttf",
    ));
    font = create(fontBuffer) as Font;
  }


  const re = "[^a-zA-Z0-9-_ ]";
  const MAX_FONT_NAME_CHAR = 31;
  let fontRenamed = false;
  if (
    new RegExp(re).test(font.fullName) ||
    font.fullName.length > MAX_FONT_NAME_CHAR ||
    font.fullName !== font.fullName.trim()
  ) {
    warning(
      `found non-standard characters in the name of the font (${font.fullName}) ` +
      `or it's too long. Sometimes such fonts can't be recognized by the .ass ` +
      "format. Attempting to rename the font..."
    );
    let newName = font.fullName.replace(new RegExp(re, 'g'), '').trim() || "My Font";
    if (newName.length > MAX_FONT_NAME_CHAR) {
      newName = newName.slice(0, MAX_FONT_NAME_CHAR);
    }
    try {
      let fontEdit = createFont(fontBuffer, { type: "ttf" });
      const fontData = fontEdit.get()
      fontData.name.fontFamily = newName;
      fontData.name.fullName = newName;

      fontBuffer = fontEdit.write({ toBuffer: true, type: "ttf" });
      font = create(fontBuffer) as Font;
      fontRenamed = true;
    } catch {
      warning("could not rename the font");
    }
  }


  let variationAxes: VariationAxes = {};
  const fontAxes = Object.entries(font.variationAxes || {});
  const namedVariations = Object.entries(font.namedVariations || {});

  if (!embedFont) {
    if (fontAxes.length) {
      throw new AppError("--no-embed-font: can't skip embedding for a variable font");
    }
    if (fontRenamed) {
      throw new AppError("--no-embed-font: the font was renamed, can't skip embedding");
    }
    warning(
      "--no-embed-font: the font will not be embedded into the " +
      "generated file. It must be installed on your machine for the subtitles " +
      "to be displayed correctly"
    )
  }

  if (fontAxes.length) {
    if (interactive) {
      async function promptForCustomValues() {
        for (const axis of fontAxes) {
          const tagName = axis[0];
          const values = axis[1];
          if (!values || !Number.isFinite(values.min) || !Number.isFinite(values.max)) {
            error(`could not get properties for tag '${tagName}'`);
            continue;
          }
          const { name, min, max, default: defaultValue } = values;
          const resp = await number({
            message: `${name ?? tagName} (${values.min} - ${values.max})`,
            validate: (n: number | undefined) =>
              typeof n === "number" &&
              n >= min &&
              n <= max,
            default: defaultValue ?? min,
            theme: {
              prefix: "",
              style: {
                answer: (t: string) => style(t, "dim"),
                message: (t: string) => t + ":",
                error: () => style("Expected a numeric value within the range", "red"),
                defaultAnswer: (t: string) => style("[default: " + t + "]", "dim"),
              }
            }
          })
          variationAxes[tagName] = resp!;
        }
      }
      if (namedVariations.length) {
        const resp = await select({
          message: "Select a font variation",
          choices: namedVariations.map((variation) => {
            const name = variation[0];
            const tagsObj = variation[1];
            return {
              name,
              description: Object.entries(tagsObj).map(([tagName, value]) =>
                `${font.variationAxes[tagName]!.name}: ${value}`).join(", "),
              value: tagsObj,
            }
          }).concat({
            name: style("Custom", "underline"),
            description: "Enter custom values for the available axes",
            value: {},
          }),
          pageSize: 15,
          theme: selectPromptTheme,
        });
        if (Object.keys(resp).length) {
          variationAxes = resp;
        } else {
          await promptForCustomValues();
        }
      } else {
        console.log("Enter values for the available axes:");
        await promptForCustomValues();
      }
      try {
        font = font.getVariation(variationAxes);
      } catch (e: any) {
        throw new AppError("could not apply the font variation: " + e.message);
      }
    } else {
      warning(
        `font ${highlight(font.fullName)} is variable but interactivity is off. ` +
        "Using default variation"
      );
    }
  }

  const sizeCalculator = new SizeCalculator(config_params);

  for (let i = 0; i < inputVideos.length; i++) {
    const inputSubFile = resolve(inputSubs[oneSrtFile ? 0 : i]);
    const inputSubName = basename(inputSubFile);
    const inputVideoFile = resolve(inputVideos[i]);
    const outputPath = outputDir ?? dirname(inputVideoFile);
    const suffix = config_params.miscellaneous.suffix;
    const ext = suffix ? `${suffix}.ass` : "ass";
    const outputSubName = outputFileName ?? setExtension(basename(inputVideoFile), ext);
    const outputSubFile = join(outputPath, outputSubName);

    function printFail(err: string | Error, prefix: string) {
      if (typeof err !== "string") {
        throw err;
      }
      error(err, prefix);
      printResult(outputSubName, false);
      process.exitCode = 3;
    }

    let resX: number, resY: number, matrix: string;
    try {
      [resX, resY, matrix] = await getVideoResolution(inputVideoFile);
    } catch {
      if (resolution) {
        if (!/^\d+[xх]\d+$/.test(resolution)) {
          throw new AppError("--resolution: incorrect format");
        }
        [resX, resY] = resolution.split(/[xх]/).map(s => parseInt(s));
        matrix = "None";
      } else {
        printFail(
          `failed to detect the resolution of video ${highlight(inputVideoFile)}. ` +
          "If the path is correct, please provide --resolution",
          basename(inputVideoFile)
        );
        continue;
      }
    }

    sizeCalculator.updateValues(resY, config_params.styles.consistent_font_size);

    const subs: VideoSubs = new VideoSubs();
    try {
      await subs.createFromInputFile(inputSubFile, config_params);
    } catch (e: any) {
      printFail(e, inputSubName);
      continue;
    }


    const CHARS_UNICODE = [
      ["NUL", "Null character"], ["SOH", "Start of Heading"], ["STX", "Start of Text"],
      ["ETX", "End of Text"], ["EOT", "End of Transmission"], ["ENQ", "Enquiry"],
      ["ACK", "Acknowledge"], ["BEL", "Bell, Alert"], ["BS", "Backspace"],
      ["HT", "Horizontal Tab"], ["LF", "Line Feed"], ["VT", "Vertical Tabulation"],
      ["FF", "Form Feed"], ["CR", "Carriage Return"], ["SO", "Shift Out"],
      ["SI", "Shift In"], ["DLE", "Data Link Escape"], ["DC1", "Device Control One (XON)"],
      ["DC2", "Device Control Two"], ["DC3", "Device Control Three (XOFF)"],
      ["DC4", "Device Control Four"], ["NAK", "Negative Acknowledge"],
      ["SYN", "Synchronous Idle"], ["ETB", "End of Transmission Block"],
      ["CAN", "Cancel"], ["EM", "End of medium"], ["SUB", "Substitute"],
      ["ESC", "Escape"], ["FS", "File Separator"], ["GS", "Group Separator"],
      ["RS", "Record Separator"], ["US", "Unit Separator"], ["SP", "Space"],
    ];
    const unsupported: string[] = [];
    const subCharset = subs.getCharset();
    for (const char of subCharset) {
      if (!font.characterSet.includes(getUnicodeDecimal(char))) {
        unsupported.push(char);
      }
    }
    const basicHiragana73 = "[あいうえお-ちっつて-ろわをん]";
    const hiraganaFontMatched = font
      .characterSet.map(u => getChar(u)).join("")
      .match(new RegExp(basicHiragana73, "ug"));
    if (
      new RegExp(basicHiragana73, "u").test(subCharset) &&
      (!hiraganaFontMatched || hiraganaFontMatched.length < 73)
    ) {
      printFail(
        `found Japanese text but font ${highlight(font.fullName)} ` +
        "does not support basic hiragana. Please choose another font",
        inputSubName
      );
      continue;
    }
    if (unsupported.length) {
      let furiganaOnlyCount = 0;
      const textOnlyCharset = subs.getCharset(true);
      for (const char of unsupported) {
        if (!textOnlyCharset.includes(char)) {
          furiganaOnlyCount++;
        }
      }
      const PRINT_CHARS = 20;
      const [printChars, collapsed] =
        ((unsupported.length <= PRINT_CHARS) || printAllChars)
          ? [unsupported.length, false]
          : [PRINT_CHARS, true];
      let errMes = `${unsupported.length} out of ${subCharset.length} required ` +
        `characters are unsupported by font ${highlight(font.fullName)}: ` +
        unsupported.slice(0, printChars).map(char => {
          const unicode = getUnicodeDecimal(char);
          let printChar = char;
          if (unicode < 33) {
            const [short, long] = CHARS_UNICODE[unicode];
            printChar = `<${short}> - ${long}`;
          }
          return `'${printChar}' (${getUnicodeHex(char)})`;
        }).join(", ");
      if (collapsed) {
        errMes += `... (${unsupported.length - printChars} more hidden)` +
          ". Add '-U' to see the complete character list";
      }
      errMes += ".\nPlease use another font or substitute these characters";
      if (furiganaOnlyCount) {
        errMes += `.\nNote: ${furiganaOnlyCount} of these characters are not ` +
          "present in the input file but generated as furigana"
      }
      printFail(errMes, inputSubName);
      continue;
    }


    try {
      processSubs(subs, font, resX, resY);
    } catch (e: any) {
      printFail(e, outputSubName);
      continue;
    }


    let assData: string;
    try {
      assData = await compileAss(
        resX,
        resY,
        matrix,
        font,
        fontBuffer,
        config_params,
        subs,
        variationAxes,
        embedFont,
      );
    } catch (e: any) {
      printFail(e, outputSubName);
      continue;
    }
    try {
      await fs.writeFile(outputSubFile, assData, { encoding: "utf-8" });
      printResult(outputSubName, true);
    } catch (e: any) {
      printFail(e.message, outputSubName);
      continue;
    }
    if (generateBlueprint && !inputSubName.endsWith(".bp")) {
      const blueprintFile = setExtension(inputSubFile, "bp");
      try {
        await fs.writeFile(blueprintFile, subs.generateBlueprint(), { encoding: "utf-8" });
      } catch (e: any) {
        error("could not save blueprint: " + e.message, basename(blueprintFile));
      }
    }
  }
} catch (e: any) {
  process.exitCode = 1;
  if (e instanceof Error) {
    if (e.name === "ExitPromptError") {
      process.exitCode = 130;
    } else if (e.name === "AppError") {
      console.log(e.message);
    } else {
      console.log(e.stack ?? e.message);
    }
  } else {
    console.log(e ?? "An unknown error occurred. Exiting...");
  }
}