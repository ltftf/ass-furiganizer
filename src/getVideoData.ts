import fluentFfmpeg from "@ts-ffmpeg/fluent-ffmpeg";
import { path as ffprobePath } from "@ffprobe-installer/ffprobe";
import { exec } from "child_process";
import { warning } from "./log.js";
import { basename } from "path";
import { VideoData } from "./types.js";

let fluentFfmpegPathSet = false;

function getMatrixString(
  colorRange: string | undefined,
  colorSpace: string | undefined,
): string {
  if (
    !colorRange || !["tv", "pc"].includes(colorRange.toLowerCase()) ||
    !colorSpace || !["bt601", "bt709"].includes(colorSpace.toLowerCase())
  ) {
    return "None";
  }
  return `${colorRange.toUpperCase()}.${colorSpace.slice(2)}`;
}

function getResolution(
  width: number | undefined,
  height: number | undefined,
  sar: string | undefined,
  video: string,
): [number, number] | null {
  if (
    !width || !height ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 || height <= 0
  ) {
    return null;
  }
  if (!sar || !/^\d+:\d+$/.test(sar)) {
    warning(
      "could not determine the sample aspect ratio of the video. Assuming 1:1",
      basename(video)
    );
    sar = "1:1";
  }
  if (sar !== "1:1") {
    const [sarW, sarH] = sar.split(":").map((v) => parseInt(v));
    const displayRatio = (width * sarW) / (height * sarH);
    width = Math.round(height * displayRatio);
  }
  return [width, height];
}

function getDataFluent(video: string): Promise<VideoData> {
  return new Promise((resolve, reject) => {
    if (!fluentFfmpegPathSet) {
      try {
        fluentFfmpeg.setFfprobePath(ffprobePath);
        fluentFfmpegPathSet = true;
      } catch {
        return reject();
      }
    }
    fluentFfmpeg.ffprobe(video, (err, data) => {
      if (err) {
        return reject();
      }
      const streamIndex = data.streams.findIndex((s) => s.codec_type === "video");
      const stream = data.streams[streamIndex];
      if (!stream) {
        return reject();
      }
      let { width, height, sample_aspect_ratio } = stream;
      const res = getResolution(width, height, sample_aspect_ratio, video);
      const matrix = getMatrixString(stream.color_range, stream.color_space);
      if (res) {
        resolve([...res, matrix]);
      } else {
        reject();
      }
    });
  });
}

function getData(video: string, streamIndex: number): Promise<VideoData | null> {
  return new Promise((resolve) => {
    exec(
      `${ffprobePath} -v error -select_streams v:${streamIndex} ` +
      "-show_entries stream=width,height,sample_aspect_ratio,color_range,color_space " +
      `-of csv=s=_:p=0 "${video.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err) {
          return resolve(null);
        }
        if (!stdout || !stdout.trim()) {
          return resolve(null);
        }
        const [w, h, sar, cr, cs] = stdout.trim().split("_");
        const res = getResolution(parseInt(w), parseInt(h), sar, video);
        const matrix = getMatrixString(cr, cs);
        if (res) {
          resolve([...res, matrix]);
        } else {
          resolve(null);
        }
      });
  })
}

function getDataCmd(video: string): Promise<VideoData> {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < 10; i++) {
      const data = await getData(video, i);
      if (data) {
        return resolve(data);
      }
    }
    reject();
  })
}

export async function getVideoResolution(video: string): Promise<VideoData> {
  try {
    return await getDataFluent(video);
  } catch {
    return await getDataCmd(video);
  }
}
