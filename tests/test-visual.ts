/**
 * it would be impossible to properly test this library programmatically 
 * so this script will generate subtitles for each setting and launch 
 * mpv player to see if it works as intended
 */
import { exec, spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { stringifyTOML } from "confbox";
import ora from 'ora';
import chalk from "chalk";
import { config_params, CONFIG_NAME, CONFIG_PATH } from "./getConfigParams.js";
import { Param } from "../src/types.js";

const spinner = ora({
  spinner: { frames: [' ', '.', '..', '...'], interval: 100 },
  color: "white",
  discardStdin: false,
});

function log(str: string) {
  spinner.suffixText += "\n" + str.trim();
}

async function run(opts: any, video: string, draw?: string[]) {
  let cmd = ["index.js"];
  for (const opt in opts) {
    cmd.push("-" + opt)
    const value = opts[opt];
    if (value && typeof value === "string") {
      cmd.push(value);
    }
  }

  return new Promise<void>(resolve => {
    const furiganize = spawn("node", cmd, { cwd: 'bin' });
    furiganize.on("error", err => { throw err });
    for (const std of ["stdout", "stderr"]) {
      furiganize[std as "stdout" | "stderr"].on("data", (data) => {
        log(data.toString());
      });
    }
    furiganize.on("exit", (code) => {
      if (code !== 0) {
        log("Exited with code " + code);
        log("Press Ctrl-c to exit");
        return;
      }
      log("launching mpv player...");
      let cmd = `mpv ${video}`;
      if (draw) {
        cmd += " --vf=";
        cmd += draw
          .map(d => {
            const [type, data] = d.split("#");
            return `draw${type}=${data}`;
          })
          .join(",");
      }
      exec(cmd + " > /dev/null 2>&1", (error) => {
        if (error && error.code !== 4) {
          throw error;
        }
        resolve();
      })
    });
  })
}

function resetConfigParams() {
  config_params.positioning.position = 3;
  config_params.positioning.align = "auto";
  config_params.positioning.furigana_offset = 0;
  config_params.positioning.line_distance = 0;
  config_params.positioning.margin = 0;
  config_params.positioning.shift = [0, 0];

  config_params.styles.text.fontsize = 40;
  config_params.styles.text.bold = false;
  config_params.styles.text.italic = false;
  config_params.styles.text.outline = 0;
  config_params.styles.text.shadow = 0;
  config_params.styles.text.color = "white";
  config_params.styles.text.outline_color = "black";
  config_params.styles.text.shadow_color = "black";

  config_params.styles.furigana.fontsize = 23;
  config_params.styles.furigana.bold = false;
  config_params.styles.furigana.italic = false;
  config_params.styles.furigana.outline = 0;
  config_params.styles.furigana.shadow = 0;
  config_params.styles.furigana.color = "white";
  config_params.styles.furigana.outline_color = "black";
  config_params.styles.furigana.shadow_color = "black";

  config_params.styles.opaque_box!.enable = false;
  config_params.styles.opaque_box!.padding = 0;
  config_params.styles.opaque_box!.outline = 0;
  config_params.styles.opaque_box!.shadow = 0;
  config_params.styles.opaque_box!.border_radius = 0;
  config_params.styles.opaque_box!.color = "black";
  config_params.styles.opaque_box!.outline_color = "black";
  config_params.styles.opaque_box!.shadow_color = "black";

  config_params.styles.consistent_font_size = false;

  config_params.miscellaneous.interactive = false;
}

function setConfigParam(param: Param, value: any) {
  const keys = param.split(".");
  let i = 0, o = config_params;
  for (; i < keys.length - 1; i++) {
    o = o[keys[i]];
  }
  o[keys[i]] = value;
}

type Test = [Param, any][];
interface TestBlock {
  explanation: string;
  tests: Test[];
  sub?: string;
  video?: string;
  draw?: string[];
}

const MARGIN_TEST = [50, 150]
const width = 1280;
const height = 720;
const xCenter = width / 2;
const yCenter = height / 2;
const grid = [
  `grid#0:0:40:40:898989:1`,
  `box#0:${yCenter}:${width}:1:red:1`,
  `box#${xCenter}:0:1:${height}:red:1`,
];
const margin = [
  ...MARGIN_TEST
    .map(m => `box#${m}:${m}:${width - m * 2}:${height - m * 2}:debf92:1`),
  `box#0:${yCenter}:${width}:1:red:1`,
  `box#${xCenter}:0:1:${height}:red:1`,
];
const textSize = [
  `box#0:${28}:${width}:1:debf92:1`,
  `box#0:${42 + 28}:${width}:1:debf92:1`,
  `box#0:${height - 71}:${width}:1:debf92:1`,
  `box#0:${height - 71 * 2}:${width}:1:debf92:1`,
]

const tests: TestBlock[] = [
  {
    explanation: "Test positioning and alignment",
    draw: grid,
    tests: [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(position => {
      return ["start", "center", "end"].map(align => {
        return [
          ["positioning.position", position],
          ["positioning.align", align],
        ] as Test
      })
    }),
  },
  {
    explanation: "Test furigana offset and line distance",
    video: "1280x720.mp4",
    tests: [3, 9].flatMap(position => {
      return [10, -10].flatMap(lineDist => {
        return [10, -10].map(furiOffset => {
          return [
            ["positioning.position", position],
            ["positioning.line_distance", lineDist],
            ["positioning.furigana_offset", furiOffset],
          ] as Test
        })
      })
    })
  },
  {
    explanation: "Test margin",
    draw: margin,
    tests: [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(position => {
      return [...MARGIN_TEST, -10].map(margin => {
        return [
          ["positioning.position", position],
          ["positioning.margin", margin],
        ] as Test
      })
    }),
  },
  {
    explanation: "Test shift",
    video: "1280x720.mp4",
    draw: margin,
    tests: [1, 9].flatMap(pos => {
      return [50, -50].flatMap(x => {
        return [50, -50].map(y => {
          return [
            ["positioning.position", pos],
            ["positioning.shift.0", x],
            ["positioning.shift.1", y],
          ] as Test
        })
      })
    }),
  },
  {
    explanation: "Test dialogue overlap",
    sub: "overlap.srt",
    video: "overlap.mp4",
    tests: [
      [3, 0, 0],
      [9, 20, 0],
      [7, 0, 20],
    ].map(([pos, lineDistance, furiganaOffset]) => {
      return [
        ["positioning.position", pos],
        ["positioning.furigana_offset", furiganaOffset],
        ["positioning.line_distance", lineDistance],
      ] as Test
    }),
  },
  {
    explanation: "Test dialogue repositioning",
    sub: "reposition.srt",
    video: "overlap.mp4",
    draw: margin,
    tests: [
      [
        ["positioning.position", 2],
        ["positioning.margin", 50],
      ]
    ]
  },
  {
    explanation: "Test dialogue repositioning with overlap",
    sub: "reposition-overlap.srt",
    video: "overlap.mp4",
    tests: [
      [
        ["positioning.position", 2],
      ]
    ]
  },
  {
    explanation: "Test fontsize",
    sub: "one-line.srt",
    video: "1280x720.mp4",
    draw: textSize,
    tests: [[40, 27, 8], [70, 70, 2]].map(([textSize, furiganaSize, pos]) => {
      return [
        ["positioning.position", pos],
        ["styles.text.fontsize", textSize],
        ["styles.furigana.fontsize", furiganaSize],
      ] as Test
    })
  },


  // {
  //   explanation: "Test outline, shadow",
  //   sub: "one-line.srt",
  //   tests:
  //     ["text", "furigana"].flatMap(t => {
  //       return ["outline", "shadow"].flatMap(s => {
  //         return [3, 10].map(size => {
  //           return [
  //             ["positioning.position", 2],
  //             [`styles.${t}.${s}_color`, "red"],
  //             [`styles.${t}.${s}`, size],
  //           ] as Test
  //         })
  //       })
  //     })
  // },
  // {
  //   explanation: "Test color types",
  //   sub: "one-line.srt",
  //   tests:
  //     ["yellow", "rgb(255,0,0)", "rgba(255,0,0,0.5)", "#43ac54"]
  //       .map(color => {
  //         return [
  //           [`styles.text.color`, color],
  //         ] as Test
  //       })
  // },
  // {
  //   explanation: "Test color styles",
  //   sub: "one-line.srt",
  //   tests: [[
  //     ["styles.text.outline", 2],
  //     ["styles.text.shadow", 2],
  //     ["styles.furigana.outline", 2],
  //     ["styles.furigana.shadow", 2],
  //     ["styles.text.outline_color", "#43ac54"],
  //     ["styles.text.shadow_color", "red"],
  //     ["styles.furigana.outline_color", "red"],
  //     ["styles.furigana.shadow_color", "#43ac54"],
  //   ]]
  // },


  {
    explanation: "Test opaque box",
    sub: "one-line.srt",
    tests: [
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.padding", 10],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.padding", -5],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.padding", -1000],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.padding", [100, 20]],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 100],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.padding", [20, 90]],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.outline", 5],
        ["styles.opaque_box.outline_color", "yellow"],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.shadow", 5],
        ["styles.opaque_box.shadow_color", "yellow"],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.color", "#43ac54"],
        ["styles.opaque_box.padding", 10],
        ["styles.opaque_box.border_radius", 5],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.color", "#43ac54"],
        ["styles.opaque_box.padding", 10],
        ["styles.opaque_box.border_radius", 15],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.color", "#43ac54"],
        ["styles.opaque_box.padding", 10],
        ["styles.opaque_box.border_radius", 100000],
      ],
      [
        ["positioning.position", 2],
        ["positioning.margin", 30],
        ["styles.opaque_box.enable", true],
        ["styles.opaque_box.color", "#43ac54"],
        ["styles.opaque_box.padding", 10],
        ["styles.opaque_box.border_radius", 8],
        ["styles.opaque_box.outline", 5],
        ["styles.opaque_box.shadow", 5],
        ["styles.opaque_box.outline_color", "yellow"],
        ["styles.opaque_box.shadow_color", "red"],
      ],
    ]
  },
  {
    explanation: "Test non-standard aspect ratio (1:2)",
    video: "1280x720_640x720_sar1-2.mp4",
    sub: "one-line.srt",
    tests: [3, 7].map(position => {
      return [
        ["positioning.position", position],
      ] as Test
    })
  },
  {
    explanation: "Test non-standard aspect ratio (2:1)",
    video: "1280x720_2560x720_sar2-1.mp4",
    sub: "one-line.srt",
    tests: [3, 7].map(position => {
      return [
        ["positioning.position", position],
      ] as Test
    })
  },
  {
    explanation: "Test consistent font size",
    sub: "one-line.srt",
    tests: [3, 7].map(position => {
      return [
        ["positioning.position", position],
        ["styles.consistent_font_size", true],
      ] as Test
    })
  },
  {
    explanation: "Test consistent font size for non-standard sar",
    video: "1280x720_2560x720_sar2-1.mp4",
    sub: "one-line.srt",
    tests: [3, 7].map(position => {
      return [
        ["positioning.position", position],
        ["styles.consistent_font_size", true],
      ] as Test
    })
  },
];



const PADDING = 5;
for (let b = 0; b < tests.length; b++) {
  const block = tests[b];
  console.log(chalk.bold(`[${b + 1}/${tests.length}] ${block.explanation} (${block.tests.length} tests)`));

  for (let t = 0; t < block.tests.length; t++) {
    const test = block.tests[t];

    let log = "";

    resetConfigParams();
    for (const [param, value] of test) {
      setConfigParam(param, value);
      log += `${" ".repeat(PADDING)}${chalk.blueBright(param)}: ${value}\n`;
    }

    log = `${t + 1}. `.padStart(PADDING, " ") + log.trim();

    spinner.prefixText = log;
    spinner.suffixText = "";
    spinner.start();

    const video = path.join(import.meta.dirname, "videos", block.video ?? "1280x720.mp4");
    const srtPath = path.join(import.meta.dirname, "subs", block.sub ?? "sub.srt");

    const strToml = stringifyTOML(config_params);
    await fs.writeFile(CONFIG_PATH, strToml);
    await run({
      i: srtPath,
      v: video,
      c: CONFIG_NAME,
    }, video, block.draw);

    spinner.stop();
  }
}
