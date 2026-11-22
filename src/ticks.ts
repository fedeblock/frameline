import { describeRate, type FrameRate } from "./timecode";

/** The marks of the ruler: labelled (major) and unlabelled (minor), as frame numbers. */
export interface Ticks { step: number; major: number[]; minor: number[] }

// Steps in frames while they are shorter than a second; then in whole seconds, at the NOMINAL rate (so at 29.97 the marks fall on timecode seconds).
const SUB_SECOND = [1, 2, 5, 10, 15];
const SECONDS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 18000, 36000];
const MIN_MINOR_PX = 5;

/** The smallest step that leaves at least `minLabelPx` between two labels, with the marks that cover the range (a step more at each end, so no label is cut). */
export function rulerTicks(range: { start: number; end: number }, pxPerFrame: number, rate: FrameRate, minLabelPx = 80): Ticks {
  const nominal = describeRate(rate).nominal;
  const candidates = [...SUB_SECOND.filter((f) => f < nominal), ...SECONDS.map((s) => s * nominal)];
  const step = candidates.find((s) => s * pxPerFrame >= minLabelPx) ?? candidates[candidates.length - 1]!;
  const first = Math.max(0, Math.floor(range.start / step) * step - step), last = Math.ceil(Math.max(range.end, range.start) / step) * step + step;
  const divisions = [10, 5, 4, 2].find((d) => step % d === 0 && (step / d) * pxPerFrame >= MIN_MINOR_PX) ?? 1;
  const major: number[] = [], minor: number[] = [];
  for (let f = first; f <= last && major.length < 400; f += step) {
    major.push(f);
    if (divisions > 1) for (let k = 1; k < divisions; k++) minor.push(f + (step / divisions) * k);
  }
  return { step, major, minor };
}
