/** The part of the sequence on screen, and the maths between frames and pixels. Pure: the DOM layer only reads and writes these numbers. */
export interface View {
  /** Pixels per frame (zoom). Frames, not seconds: the scale is exact whatever the frame rate. */
  pxPerFrame: number;
  /** The first visible frame (may be fractional while scrolling). */
  scrollFrame: number;
  /** Width of the visible area in pixels. */
  widthPx: number;
}

export interface ZoomLimits { min: number; max: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const frameToX = (frame: number, v: View): number => (frame - v.scrollFrame) * v.pxPerFrame;
export const xToFrame = (x: number, v: View): number => v.scrollFrame + x / v.pxPerFrame;
export const visibleRange = (v: View): { start: number; end: number } => ({ start: v.scrollFrame, end: v.scrollFrame + v.widthPx / v.pxPerFrame });

/** Keeps the view inside the sequence: not before frame 0, not past the end; a sequence shorter than the width does not scroll. */
export function clampScroll(v: View, durationFrames: number): View {
  const max = Math.max(0, durationFrames - v.widthPx / v.pxPerFrame);
  return { ...v, scrollFrame: clamp(v.scrollFrame, 0, max) };
}

/** Zoom by `factor` around the pixel `anchorX`: the frame under that pixel stays under it. */
export function zoomAt(v: View, factor: number, anchorX: number, limits: ZoomLimits, durationFrames: number): View {
  const pxPerFrame = clamp(v.pxPerFrame * factor, limits.min, limits.max);
  const anchorFrame = xToFrame(anchorX, v);
  return clampScroll({ ...v, pxPerFrame, scrollFrame: anchorFrame - anchorX / pxPerFrame }, durationFrames);
}

/** The zoom at which the whole duration fits the width, within the limits. */
export function fitPxPerFrame(durationFrames: number, widthPx: number, limits: ZoomLimits): number {
  if (!(durationFrames > 0)) return limits.max;
  return clamp(widthPx / durationFrames, limits.min, limits.max);
}
