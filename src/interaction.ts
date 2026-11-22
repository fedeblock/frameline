/** The maths of dragging, snapping and nudging. Pure and frame-exact: every answer is a whole frame. */

/** Pulls `frame` to the nearest target within `thresholdFrames` (the earlier one on a tie); else the nearest whole frame. */
export function snapFrame(frame: number, targets: readonly number[], thresholdFrames: number): number {
  let best = Math.round(frame), bestDistance = Infinity;
  if (thresholdFrames > 0) {
    for (const t of targets) {
      const distance = Math.abs(t - frame);
      if (distance <= thresholdFrames && distance < bestDistance) { best = t; bestDistance = distance; }
    }
  }
  return best;
}

/** The move for a group of keys, shortened so none leaves [min, max]; the group keeps its shape. */
export function clampDelta(frames: readonly number[], delta: number, min: number, max: number): number {
  if (frames.length === 0) return 0;
  const lowest = Math.min(...frames), highest = Math.max(...frames);
  return Math.max(min - lowest, Math.min(max - highest, delta));
}

/** What an arrow key does: one frame, with Shift one second at the nominal rate; anything else, nothing. */
export function nudgeBy(key: string, shift: boolean, nominalFps: number): number {
  const sign = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
  return sign * (shift ? nominalFps : 1);
}

/** The rows a vertical band (pixels from the top of the first row) touches, in order. */
export function rowsInBand(y0: number, y1: number, rowHeight: number, rowCount: number): number[] {
  const top = Math.min(y0, y1), bottom = Math.max(y0, y1);
  const out: number[] = [];
  for (let r = 0; r < rowCount; r++) if (r * rowHeight < bottom && (r + 1) * rowHeight > top) out.push(r);
  return out;
}
