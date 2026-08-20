import { warning } from "./log.js";
import { ConfigParams, Substitute } from "./types.js";
import { AppError } from "./utils.js";

export function verifyConfigParams(params: ConfigParams, configName: string, paramsRef: ConfigParams) {
  if (!params || !Object.entries(params).length) {
    throw new AppError("config is empty", configName);
  }
  for (const section of ["positioning", "styles", "miscellaneous"]) {
    if (!(section in params)) {
      throw new AppError(`section '${section}' is missing`, configName);
    }
  }
  for (const section of ["text", "furigana"]) {
    if (!(section in params.styles)) {
      throw new AppError(`section 'styles.${section}' is missing`, configName);
    }
  }


  const path: string[] = [];
  function checkKeys(paramKeys: any, refKeys: any) {
    for (const key of Object.keys(paramKeys)) {
      if (!Object.keys(refKeys).includes(key)) {
        throw new AppError(`unexpected key: '${path.concat(key).join(".")}'`, configName);
      }
    }
  }
  function checkUnexpected() {
    let _params = params;
    let _paramsRef = paramsRef;
    for (const p of path) {
      _params = _params[p];
      _paramsRef = _paramsRef[p];
    }
    if (_params && typeof _params === "object" && !Array.isArray(_params)) {
      checkKeys(_params, _paramsRef);
      for (const key of Object.keys(_params)) {
        path.push(key);
        checkUnexpected();
      }
    }
    path.splice(-1);
  }
  checkUnexpected();


  function verifyAxesArray(section: any, p1: string, p2: string) {
    const value = section[p1][p2];
    if (typeof value !== "undefined") {
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        !value.every(val => Number.isFinite(val))
      ) {
        warning(`'${p1}.${p2}': expected an array of two numbers: [x, y]. Using default`, configName);
        section[p1][p2] = undefined;
      }
    }
  }

  if (
    !Number.isInteger(params.positioning.position) ||
    params.positioning.position < 1 ||
    params.positioning.position > 9
  ) {
    warning("'position': expected an integer (1-9). Using: 2", configName);
    params.positioning.position = 2;
  }
  if (!["auto", "start", "center", "end"].includes(params.positioning.align)) {
    warning("'align' must be 'start', 'center', 'end' or 'auto'. Using: 'auto'", configName);
    params.positioning.align = "auto";
  }
  if (!Number.isFinite(params.positioning.furigana_offset)) {
    warning("'furigana_offset': expected a number. Using: 8", configName);
    params.positioning.furigana_offset = 8;
  }
  if (!Number.isFinite(params.positioning.line_distance)) {
    warning("'line_distance': expected a number. Using: 22", configName);
    params.positioning.line_distance = 22;
  }
  if (!Number.isFinite(params.positioning.margin)) {
    warning("'margin': expected a number. Using: 90", configName);
    params.positioning.margin = 90;
  }
  verifyAxesArray(params, "positioning", "shift");


  const box = params.styles.opaque_box;
  if (box) {
    if (typeof box.enable !== "boolean") {
      warning("opaque_box.enable: expected a boolean", configName);
      box.enable = false;
    }
    if (box.enable) {
      if (typeof box.padding !== "number") {
        if (
          !Array.isArray(box.padding) ||
          box.padding.length !== 2 ||
          !box.padding.every(val => typeof val === "number")
        ) {
          warning("opaque_box.padding: expected a number or array of two numbers. Using: 20", configName);
          box.padding = 20;
        }
      }
    }
  }


  function notUndefinedOr(
    type: "string" | "boolean" | "number",
    value: string | boolean | number | undefined
  ) {
    return !["undefined", type].includes(typeof value);
  }

  let sf = params.styles.furigana.scale_factor;
  if (
    notUndefinedOr("number", sf) ||
    (typeof sf === "number" && sf <= 0)
  ) {
    warning(
      `furigana.scale_factor: expected a positive number. ` +
      "Using 'styles.furigana' styles",
      configName
    );
    sf = params.styles.furigana.scale_factor = undefined;
  }


  if (
    !Number.isFinite(params.styles.text.fontsize) ||
    params.styles.text.fontsize <= 0
  ) {
    warning(`'text.fontsize': expected a positive number. Using: 40`, configName);
    params.styles.text.fontsize = 40;
  }
  if (
    !sf && (!Number.isFinite(params.styles.furigana.fontsize) ||
      params.styles.furigana.fontsize <= 0)
  ) {
    warning(`'furigana.fontsize': expected a positive number. Using: 16`, configName);
    params.styles.furigana.fontsize = 16;
  }
  for (
    const t of ["text"].concat(sf ? [] : "furigana")
  ) {
    for (const s of ["bold", "italic"]) {
      if (notUndefinedOr("boolean", params.styles[t][s])) {
        warning(`'${t}.${s}': expected a boolean. Using: false`, configName);
        params.styles[t][s] = false;
      }
    }
  }
  for (
    const t of ["text"]
      .concat(sf ? [] : "furigana")
      .concat(box?.enable ? "opaque_box" : [])
  ) {
    for (const s of ["outline", "shadow"].concat(box?.enable ? "border_radius" : [])) {
      if (t !== "opaque_box" && s === "border_radius") {
        continue;
      }
      if (
        !Number.isFinite(params.styles[t][s]) ||
        params.styles[t][s] < 0
      ) {
        warning(`'${t}.${s}': expected a positive number or 0. Using: 0`, configName);
        params.styles[t][s] = 0;
      }
    }
  }
  for (
    const t of ["text"]
      .concat(sf ? [] : "furigana")
      .concat(box?.enable ? "opaque_box" : [])
  ) {
    for (const s of ["color", "outline_color", "shadow_color"]) {
      if (!params.styles[t][s] || typeof params.styles[t][s] !== "string") {
        const color = s === "color" && t !== "opaque_box" ? "white" : "black";
        warning(`'${t}.${s}': expected a string. Using: '${color}'`, configName);
        params.styles[t][s] = color;
      }
    }
  }

  if (params.styles.blur) {
    for (const t of ["text", "furigana"].concat(box?.enable ? "opaque_box" : [])) {
      const value = params.styles.blur[t];
      if (
        notUndefinedOr("number", value) ||
        (typeof value === "number" && value < 0)
      ) {
        warning(`styles.blur.${t}: expected a positive number or 0. Using: 0`, configName);
        params.styles.blur[t] = 0;
      }
    }
  }

  if (params.styles.shadow_direction) {
    for (const t of ["text", "furigana"].concat(box?.enable ? "opaque_box" : [])) {
      verifyAxesArray(params.styles, "shadow_direction", t);
    }
  }

  if (notUndefinedOr("string", params.styles.font_path)) {
    warning("'font_path': expected a string", configName);
    params.styles.font_path = "";
  }
  if (notUndefinedOr("boolean", params.styles.consistent_font_size)) {
    warning("'consistent_font_size': expected a boolean", configName);
    params.styles.consistent_font_size = false;
  }

  if (notUndefinedOr("string", params.miscellaneous.output_dir)) {
    warning("'output_dir': expected a string, or an empty string for the default", configName);
    params.miscellaneous.output_dir = "";
  }
  if (!["kuromoji", "mecab"].includes(params.miscellaneous.analyzer)) {
    warning("'analyzer' must be 'kuromoji' or 'mecab'. Using: 'kuromoji'", configName)
    params.miscellaneous.analyzer = "kuromoji";
  }
  if (notUndefinedOr("boolean", params.miscellaneous.add_suffix)) {
    warning("'add_suffix': expected a boolean", configName)
    params.miscellaneous.add_suffix = false;
  }
  if (
    params.miscellaneous.add_suffix &&
    (!params.miscellaneous.suffix || typeof params.miscellaneous.suffix !== "string")
  ) {
    warning("'suffix': add_suffix is true, expected a string", configName)
    params.miscellaneous.add_suffix = false;
  }
  if (notUndefinedOr("boolean", params.miscellaneous.interactive)) {
    warning("'console_interactivity': expected a boolean", configName)
    params.miscellaneous.interactive = true;
  }

  if (!Object.keys(params).includes("substitute")) {
    params.substitute = {} as Substitute;
  }
  for (const type of ["text", "furigana"]) {
    if (!Object.keys(params.substitute).includes(type)) {
      params.substitute[type] = [];
    }
  }
  for (const type of ["text", "furigana"]) {
    if (
      !Array.isArray(params.substitute[type]) ||
      !params.substitute[type].every(arr => {
        return (
          Array.isArray(arr) &&
          arr.length === 2 &&
          arr.every(string => typeof string === "string")
        )
      })
    ) {
      warning(`'substitute.${type}': incorrect format`, configName)
      params.substitute[type] = [];
    } else {
      const arr = params.substitute[type];
      for (let i = arr.length - 1; i >= 0; i--) {
        const str = arr[i][0];
        if (str === "") {
          arr.splice(i, 1);
          continue;
        }
        if (type === "text") {
          if (str.startsWith("U+")) {
            if (!/^U\+[a-f0-9]{1,6}$/i.test(str)) {
              warning("incorrect unicode: " + str, configName);
              arr.splice(i, 1);
            } else {
              if (parseInt(str.replace("U+", ""), 16) > 1114111) {
                warning(str + ": unicode out of range", configName);
                arr.splice(i, 1);
              }
            }
          } else {
            arr[i][0] = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          }
        }
      }
    }
  }
}