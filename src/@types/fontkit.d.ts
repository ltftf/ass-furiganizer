import { Font as _Font } from "fontkit"
import { VariationAxes } from "../types.ts";

declare module "fontkit" {
  export interface Font extends _Font {
    namedVariations: {
      [name: string]: VariationAxes
    }
  }
}