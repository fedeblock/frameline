import { describe, expect, it } from "vitest";
import { rulerTicks } from "../src/ticks";

const R25 = { n: 25, d: 1 }, DF = { n: 30000, d: 1001 };

describe("the marks of the ruler", () => {
  it("puts labelled marks at least `minLabelPx` apart, at round times: frames when zoomed in, seconds, then minutes", () => {
    const frames = rulerTicks({ start: 0, end: 100 }, 20, R25, 80); // 20 px per frame: 5 frames = 100 px
    expect(frames.step).toBe(5);
    expect(frames.major.every((f) => f % 5 === 0)).toBe(true);
    const seconds = rulerTicks({ start: 0, end: 2250 }, 1, R25, 80); // 1 px per frame: 80+ px = 3.2+ s
    expect(seconds.step).toBe(5 * 25);
    const minutes = rulerTicks({ start: 0, end: 90_000 }, 0.05, R25, 80);
    expect(minutes.step % (60 * 25)).toBe(0);
    for (const t of [frames, seconds, minutes]) expect(t.step * (t === frames ? 20 : t === seconds ? 1 : 0.05)).toBeGreaterThanOrEqual(80);
  });

  it("covers the visible range, and a little beyond it so a label is never cut at the edge", () => {
    const t = rulerTicks({ start: 1000, end: 1400 }, 2, R25, 80);
    expect(Math.min(...t.major)).toBeLessThanOrEqual(1000);
    expect(Math.max(...t.major)).toBeGreaterThanOrEqual(1400 - t.step);
    expect(Math.min(...t.major)).toBeGreaterThanOrEqual(0);
  });

  it("minor marks sit between major ones, never on them, and are left out when they would be too close", () => {
    const t = rulerTicks({ start: 0, end: 500 }, 2, R25, 80);
    expect(t.minor.every((m) => !t.major.includes(m))).toBe(true);
    expect(t.minor.length).toBeGreaterThan(0);
    const dense = rulerTicks({ start: 0, end: 90_000 }, 0.05, R25, 80);
    const spacing = dense.minor.length > 1 ? (dense.minor[1]! - dense.minor[0]!) * 0.05 : 99;
    expect(spacing).toBeGreaterThanOrEqual(4);
  });

  it("counts seconds at the nominal rate, so 29.97 marks fall on whole timecode seconds", () => {
    const t = rulerTicks({ start: 0, end: 600 }, 1, DF, 30);
    expect(t.step % 30).toBe(0);
  });

  it("copes with the extremes: nothing visible, a huge range and a tiny width", () => {
    expect(rulerTicks({ start: 0, end: 0 }, 1, R25, 80).major.length).toBeGreaterThanOrEqual(1);
    expect(rulerTicks({ start: 0, end: 10_000_000 }, 0.0001, R25, 80).major.length).toBeLessThan(200);
  });
});
