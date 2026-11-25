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

export type SpanEdge = "move" | "start" | "end";

/**
 * Where a span ends up when it is dragged by `delta` frames: `move` keeps its length and stops at the ends of [min, max]; `start` and `end` stretch it and stop at
 * [min, max] and at `minLength` frames from the other edge (a span already shorter than that can still be moved). Whole frames.
 */
export function dragSpan(span: { start: number; end: number }, edge: SpanEdge, delta: number, min: number, max: number, minLength = 1): { start: number; end: number } {
  const d = Math.round(delta);
  if (edge === "move") {
    const clamped = clampDelta([span.start, span.end], d, min, max);
    return { start: span.start + clamped, end: span.end + clamped };
  }
  if (edge === "start") return { start: Math.max(min, Math.min(span.end - minLength, span.start + d)), end: span.end };
  return { start: span.start, end: Math.min(max, Math.max(span.start + minLength, span.end + d)) };
}

/** The drag `delta` pulled to the nearest target: the edge that is dragged for `start`/`end`; for `move`, whichever edge lands nearer to one. Otherwise the nearest whole frame. */
export function snapSpanDelta(span: { start: number; end: number }, edge: SpanEdge, delta: number, targets: readonly number[], thresholdFrames: number): number {
  const edges = edge === "move" ? [span.start, span.end] : [edge === "start" ? span.start : span.end];
  let best = Math.round(delta), bestDistance = Infinity;
  for (const e of edges) {
    const raw = e + delta, snapped = snapFrame(raw, targets, thresholdFrames);
    const distance = Math.abs(snapped - raw);
    if (targets.includes(snapped) && distance <= thresholdFrames && distance < bestDistance) { best = snapped - e; bestDistance = distance; }
  }
  return best;
}
