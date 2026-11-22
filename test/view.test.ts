import { describe, expect, it } from "vitest";
import { clampScroll, fitPxPerFrame, frameToX, visibleRange, xToFrame, zoomAt, type View } from "../src/view";

const LIMITS = { min: 0.05, max: 40 };
const v = (over: Partial<View> = {}): View => ({ pxPerFrame: 2, scrollFrame: 100, widthPx: 800, ...over });

describe("frames and pixels", () => {
  it("a frame is a place and a place is a frame, both ways, exactly", () => {
    const view = v();
    expect(frameToX(100, view)).toBe(0);
    expect(frameToX(150, view)).toBe(100);
    expect(xToFrame(100, view)).toBe(150);
    for (const f of [0, 1, 99, 100, 777, 12345]) expect(xToFrame(frameToX(f, view), view)).toBeCloseTo(f, 9);
  });

  it("the visible range is what the width shows", () => {
    expect(visibleRange(v())).toEqual({ start: 100, end: 500 });
  });
});

describe("zoom keeps what is under the pointer where it is", () => {
  it("zooming in around a pixel leaves the frame under that pixel under it", () => {
    const view = v();
    const anchorX = 300;
    const frameUnder = xToFrame(anchorX, view);
    const zoomed = zoomAt(view, 2, anchorX, LIMITS, 10_000);
    expect(zoomed.pxPerFrame).toBe(4);
    expect(xToFrame(anchorX, zoomed)).toBeCloseTo(frameUnder, 9);
  });

  it("is limited at both ends, and never scrolls to before the start or after the end", () => {
    expect(zoomAt(v({ pxPerFrame: 30 }), 10, 0, LIMITS, 10_000).pxPerFrame).toBe(40);
    expect(zoomAt(v({ pxPerFrame: 0.06 }), 0.1, 0, LIMITS, 10_000).pxPerFrame).toBe(0.05);
    expect(zoomAt(v({ scrollFrame: 0 }), 0.5, 0, LIMITS, 10_000).scrollFrame).toBeGreaterThanOrEqual(0);
    const end = zoomAt(v({ scrollFrame: 9900, pxPerFrame: 0.2 }), 1, 0, LIMITS, 10_000);
    expect(visibleRange(end).end).toBeLessThanOrEqual(10_000 + 1e-9);
  });
});

describe("fitting and scrolling", () => {
  it("fits the whole duration in the width, within the limits", () => {
    expect(fitPxPerFrame(2250, 1125, LIMITS)).toBe(0.5);
    expect(fitPxPerFrame(2, 1000, LIMITS)).toBe(40); // tiny duration: not magnified past the limit
    expect(fitPxPerFrame(0, 1000, LIMITS)).toBe(40); // nothing to fit: still a sane value
  });

  it("scroll is kept inside the sequence; a sequence shorter than the width does not scroll", () => {
    expect(clampScroll(v({ scrollFrame: -5 }), 1000).scrollFrame).toBe(0);
    expect(clampScroll(v({ scrollFrame: 900 }), 1000).scrollFrame).toBe(600); // 1000 - 800/2
    expect(clampScroll(v({ scrollFrame: 50 }), 300).scrollFrame).toBe(0);
  });
});
