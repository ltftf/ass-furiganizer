import { exec } from "child_process";
import { MatroskaData } from "./types.js";
import { escapeQuotes, setExtension } from "./utils/string.js";
import { error, info, warning } from "./log.js";
import select from "@inquirer/select";
import { join } from "path";
import ospath from "ospath";
import { selectTheme } from "./promptThemes.js";
import { AppError } from "./customErrors.js";

function getData(video: string): Promise<MatroskaData> {
  return new Promise((resolve, reject) => {
    const failError = new AppError("failed to get data from the video");
    exec(`mkvmerge --identification-format json --identify "${escapeQuotes(video)}"`, (err, stdout) => {
      if (err) {
        if (err.code === 127) {
          return reject(new AppError("command 'mkvmerge' not found. This feature requires MKVToolNix to be installed"));
        } else {
          return reject(failError);
        }
      }
      try {
        const data = JSON.parse(stdout);
        if (Object.entries(data).length) {
          resolve(data);
        } else {
          reject(failError);
        }
      } catch {
        reject(failError);
      }
    });
  });
}

function extractTrack(video: string, trackId: number, destination: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(`mkvextract tracks "${escapeQuotes(video)}" ${trackId}:"${escapeQuotes(destination)}"`, (err) => {
      if (err) {
        if (err.code === 127) {
          reject(new AppError("command 'mkvextract' not found"));
        } else {
          reject(new AppError(`failed to extract the subtitle track: ${err.message.trim()}`));
        }
      } else {
        resolve();
      }
    });
  })
}

export async function extractSrtMatroska(video: string): Promise<string> {
  info("reading mkv metadata...");
  const data = await getData(video);
  if (data.warnings) {
    for (const warnString of data.warnings) {
      warning(warnString.trim(), "mkvmerge");
    }
  }
  if (data.errors) {
    if (data.errors.length === 1) {
      throw new AppError(data.errors[0].trim());
    } else if (data.errors.length > 1) {
      for (const errorString of data.errors) {
        error(errorString.trim(), "mkvmerge");
      }
      throw new AppError("could not view the video tracks");
    }
  }
  const jpnSubTracks = data.tracks.filter(t => {
    return (
      t.codec === "SubRip/SRT" &&
      (
        t.properties.language === "jpn" ||
        t.properties.language_ietf === "ja"
      )
    );
  });
  if (!jpnSubTracks.length) {
    throw new AppError("no Japanese SRT tracks found");
  }
  let trackId: number;
  if (jpnSubTracks.length === 1) {
    trackId = jpnSubTracks[0].id;
  } else {
    trackId = await select({
      choices: jpnSubTracks.map(track => {
        return {
          name: `track ID: ${track.id} (${track.properties.language})`,
          value: track.id,
        }
      }),
      message: "Choose a subtitle track",
      theme: selectTheme,
    })
  }
  const extractedSrtPath = join(ospath.tmp(), setExtension(video, "srt"));
  info(`extracting track #${trackId} to ${extractedSrtPath}...`, true);
  await extractTrack(video, trackId, extractedSrtPath);
  info(`track #${trackId} extracted`, true);
  return extractedSrtPath;
}