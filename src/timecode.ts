/**
 * SMPTE timecode, HH:MM:SS:FF (frameline's own copy: no dependency). Whole rates (24, 25, 30, 50, 60) count frames at the nominal rate. 29.97 and 59.94 (the 1001 rates) can be
 * shown as DROP-FRAME, which keeps the clock in step with real time by skipping frame NUMBERS (never frames): 00 and 01 at the start of every
 * minute except each tenth (59.94: 00 to 03), and says so with a semicolon before the frames, `00:01:00;02`. 23.976 is counted at 24 and has
 * no drop-frame form. Pure: the same frame and rate always give the same text, and `parseTimecode` is its exact inverse.
 */
export interface FrameRate { n: number; d: number }

export interface RateInfo {
  /** The rate frames are counted at: 30 for 29.97, 60 for 59.94. */
  nominal: number;
  dropFrame: boolean;
  /** Frame numbers skipped at the start of each non-tenth minute (2 at 29.97, 4 at 59.94, else 0). */
  dropFrames: number;
  /** For the interface: «25», «29,97 DF», «59,94 DF», «23,976». */
  label: string;
}

export function describeRate(rate: FrameRate): RateInfo {
  const nominal = Math.max(1, Math.round(rate.n / rate.d));
  const drop = rate.d === 1001 && (nominal === 30 || nominal === 60);
  const label = rate.d === 1
    ? String(nominal)
    : drop ? `${nominal === 30 ? "29,97" : "59,94"} DF`
      : rate.d === 1001 ? "23,976" : (rate.n / rate.d).toFixed(3).replace(".", ",");
  return { nominal, dropFrame: drop, dropFrames: drop ? (nominal === 30 ? 2 : 4) : 0, label };
}

const two = (n: number) => String(n).padStart(2, "0");

export function formatTimecode(frame: number, rate: FrameRate): string {
  const { nominal, dropFrame, dropFrames } = describeRate(rate);
  let f = Math.max(0, Math.floor(frame));
  if (dropFrame) {
    const perMinute = nominal * 60 - dropFrames, perTenMinutes = nominal * 600 - dropFrames * 9;
    const tens = Math.floor(f / perTenMinutes), rest = f % perTenMinutes;
    f += dropFrames * 9 * tens + (rest > dropFrames ? dropFrames * Math.floor((rest - dropFrames) / perMinute) : 0);
  }
  const ff = f % nominal, ss = Math.floor(f / nominal) % 60, mm = Math.floor(f / (nominal * 60)) % 60, hh = Math.floor(f / (nominal * 3600));
  return `${two(hh)}:${two(mm)}:${two(ss)}${dropFrame ? ";" : ":"}${two(ff)}`;
}

/**
 * The frame a timecode names, or null when there is none: not digits, frames beyond the rate, or (drop-frame) a number that is skipped.
 * Either separator is accepted before the frames, and short forms are read from the right: `1:02:03` is 1 minute, 2 seconds, 3 frames.
 */
export function parseTimecode(text: string, rate: FrameRate): number | null {
  const parts = text.trim().split(/[:;]/);
  if (parts.length < 1 || parts.length > 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const [hh = 0, mm = 0, ss = 0, ff = 0] = [...Array(4 - parts.length).fill("0"), ...parts].map(Number);
  const { nominal, dropFrame, dropFrames } = describeRate(rate);
  if (ff >= nominal || ss >= 60 || mm >= 60) return null;
  if (dropFrame && ss === 0 && ff < dropFrames && mm % 10 !== 0) return null; // those frame numbers do not exist
  const totalMinutes = hh * 60 + mm;
  const frames = (hh * 3600 + mm * 60 + ss) * nominal + ff;
  return dropFrame ? frames - dropFrames * (totalMinutes - Math.floor(totalMinutes / 10)) : frames;
}
