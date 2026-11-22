import { describe, expect, it } from "vitest";
import { clampDelta, nudgeBy, rowsInBand, snapFrame } from "../src/interaction";

describe("snapping", () => {
  it("pulls a frame to the nearest target inside the threshold, else leaves it", () => {
    expect(snapFrame(103, [100, 200], 5)).toBe(100);
    expect(snapFrame(197, [100, 200], 5)).toBe(200);
    expect(snapFrame(150, [100, 200], 5)).toBe(150);
    expect(snapFrame(103, [], 5)).toBe(103);
    expect(snapFrame(103, [100], 0)).toBe(103); // no threshold: no snapping
  });

  it("takes the closer of two targets, and the earlier one on a tie (stable, never flickering)", () => {
    expect(snapFrame(103, [100, 105], 5)).toBe(105);
    expect(snapFrame(102, [100, 104], 5)).toBe(100);
  });

  it("always answers a whole frame", () => {
    expect(Number.isInteger(snapFrame(103.4, [], 5))).toBe(true);
    expect(snapFrame(103.6, [], 5)).toBe(104);
  });
});

describe("moving a selection", () => {
  it("keeps every key inside the sequence by shortening the move, never by squashing the group", () => {
    expect(clampDelta([10, 20, 30], 5, 0, 100)).toBe(5);
    expect(clampDelta([10, 20, 30], -50, 0, 100)).toBe(-10); // the first key stops at 0 and the others keep their distance
    expect(clampDelta([10, 20, 90], 50, 0, 100)).toBe(10);
    expect(clampDelta([], 5, 0, 100)).toBe(0);
  });
});

describe("keyboard nudges", () => {
  it("an arrow is one frame, with Shift a second (at the nominal rate), with the sign of the arrow", () => {
    expect(nudgeBy("ArrowRight", false, 25)).toBe(1);
    expect(nudgeBy("ArrowLeft", false, 25)).toBe(-1);
    expect(nudgeBy("ArrowRight", true, 25)).toBe(25);
    expect(nudgeBy("ArrowLeft", true, 30)).toBe(-30);
    expect(nudgeBy("Enter", false, 25)).toBe(0);
  });
});

describe("selecting with a rectangle", () => {
  it("answers the rows a vertical band touches, in order, and none for a band outside the rows", () => {
    expect(rowsInBand(10, 40, 22, 4)).toEqual([0, 1]);                 // rows are 0-22, 22-44, 44-66, 66-88
    expect(rowsInBand(0, 1, 22, 4)).toEqual([0]);
    expect(rowsInBand(80, 200, 22, 4)).toEqual([3]);
    expect(rowsInBand(100, 200, 22, 4)).toEqual([]);
    expect(rowsInBand(40, 10, 22, 4)).toEqual([0, 1]);                 // dragged upwards: same band
  });
});
