let shiftBySec: number | undefined;

export function setDialoguesShift(sec: number | undefined) {
  shiftBySec = sec;
}

export function secondsToTime(seconds: number): string {
  /**
   * https://github.com/libass/libass/wiki/ASS-File-Format-Guide
   * "Start/End: The start/end time of the event; it will only be shown in 
   *  between those times; start is in- and end exclusive. 
   *  The format is h:mm:ss.dd, with h being hours and can be 
   *  in the range [0, 595] hoursEditors, mm being minutes and
   *  a two-digit value in [00, 60], ss being seconds and also
   *  a two-digit value in [00, 60] and dd being deciseconds and 
   *  a two-digit value in the range [00, 99]. 
   *  You MUST NOT use any more or less than two digits for mm, ss and dd!"
   */
  seconds = Math.round(seconds * 100) / 100;
  if (shiftBySec) {
    seconds += shiftBySec;
  }
  if (seconds >= 595 * 60 * 60) {
    throw "subtitles more than 595 hours long are not supported";
  }
  if (seconds < 0) {
    return "";
  }
  const date = new Date(seconds * 1000);
  const days = Math.floor(seconds / (24 * 60 * 60));
  return (
    (date.getUTCHours() + days * 24).toString() + ":" +
    date.getUTCMinutes().toString().padStart(2, "0") + ":" +
    date.getUTCSeconds().toString().padStart(2, "0") + "." +
    (date.getUTCMilliseconds() / 10).toFixed().padStart(2, "0")
  )
}

export function timeToSeconds(time: string): number {
  const [hour, min, sec, ds] = time.split(/[:.]/).map(s => parseInt(s));
  return (
    hour * 60 * 60 +
    min * 60 +
    sec +
    ds / 100
  );
}

export function processAssTime(time: string) {
  if (shiftBySec) {
    return secondsToTime(timeToSeconds(time));
  }
  return time;
}
