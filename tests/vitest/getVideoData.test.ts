import { expect, test } from "vitest";
import { getVideoResolution } from "../../src/getVideoData.js";
import { join } from "node:path";

test("getVideoResolution", async () => {
  for (const [video, expected] of [
    ["1280x720.mp4", [1280, 720, "None"]],
    ["1280x720_640x720_sar1-2.mp4", [640, 720, "None"]],
    ["1280x720_2560x720_sar2-1.mp4", [2560, 720, "None"]],
  ] as [string, [number, number, string]][]) {
    expect(
      await getVideoResolution(join(import.meta.dirname, "..", "videos", video))
    ).toEqual(expected);
  }
})