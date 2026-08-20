import { ConfigParams, Param } from "./types.js";
import { round } from "./utils.js";

export class SizeCalculator {
  private params: ConfigParams;
  private params_copy: ConfigParams;

  constructor(params: ConfigParams) {
    this.params = params;
    this.setFuriganaStyle();
    this.params_copy = structuredClone(params);
  }

  private setFuriganaStyle() {
    const scaleFactor = this.params.styles.furigana.scale_factor;
    if (scaleFactor) {
      const ts = this.params.styles.text.fontsize;
      const fs = round(ts * scaleFactor);
      this.params.styles.furigana.fontsize = fs;
      const percentDiff = (ts - fs) / ((ts + fs) / 2);

      for (const field of [
        "bold",
        "italic",
        "outline",
        "shadow",
        "color",
        "outline_color",
        "shadow_color",
      ]) {
        const value = this.params.styles.text[field];
        this.params.styles.furigana[field] = typeof value === "number"
          ? round(value / Math.exp(percentDiff * 0.35))
          : value;
      }
    }
  }

  public updateValues(videoHeight: number, consistentFontSize?: boolean) {
    const params: Param[] = [
      "positioning.furigana_offset",
      "positioning.line_distance",
      "positioning.margin",
      "positioning.shift.0",
      "positioning.shift.1",
      "styles.text.fontsize",
      "styles.text.outline",
      "styles.text.shadow",
      "styles.furigana.fontsize",
      "styles.furigana.outline",
      "styles.furigana.shadow",
      "styles.opaque_box.padding",
      "styles.opaque_box.padding.0",
      "styles.opaque_box.padding.1",
      "styles.opaque_box.outline",
      "styles.opaque_box.shadow",
      "styles.opaque_box.border_radius",
      "styles.blur.text",
      "styles.blur.furigana",
      "styles.blur.opaque_box",
      "styles.shadow_direction.text.0",
      "styles.shadow_direction.text.1",
      "styles.shadow_direction.furigana.0",
      "styles.shadow_direction.furigana.1",
      "styles.shadow_direction.opaque_box.0",
      "styles.shadow_direction.opaque_box.1",
    ];
    for (const param of params) {
      const path = param.split(".");
      const field = path.splice(-1)[0];

      let initialParams = this.params_copy;
      let currentParams = this.params;
      let i = 0;
      for (; i < path.length && initialParams[path[i]]; i++) {
        initialParams = initialParams[path[i]];
        currentParams = currentParams[path[i]];
      }
      if (i === path.length && typeof initialParams[field] === "number") {
        let newValue = initialParams[field];
        if (consistentFontSize) {
          newValue *= videoHeight / 1080;
        }
        currentParams[field] = round(newValue);
      }
    }
  }
}