import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { describeRate, formatTimecode, parseTimecode, type FrameRate } from "../src/timecode";

/*
 * An independent check: `smpte-timecode` (a widely used reference library, a DEVELOPMENT dependency only) must say the same as ours for
 * every frame of two hours at each broadcast rate. The app does not ship it.
 */
const require = createRequire(import.meta.url);
type Reference = { toString(): string; frameCount: number };
const Timecode = require("smpte-timecode") as (timecode: number | string, frameRate?: number, dropFrame?: boolean) => Reference;

const RATES: { name: string; rate: FrameRate; fps: number; drop: boolean }[] = [
  { name: "25", rate: { n: 25, d: 1 }, fps: 25, drop: false },
  { name: "50", rate: { n: 50, d: 1 }, fps: 50, drop: false },
  { name: "24", rate: { n: 24, d: 1 }, fps: 24, drop: false },
  { name: "30", rate: { n: 30, d: 1 }, fps: 30, drop: false },
  { name: "60", rate: { n: 60, d: 1 }, fps: 60, drop: false },
  { name: "29.97 drop-frame", rate: { n: 30000, d: 1001 }, fps: 29.97, drop: true },
  { name: "59.94 drop-frame", rate: { n: 60000, d: 1001 }, fps: 59.94, drop: true },
];

describe("our SMPTE timecode agrees with the reference library", () => {
  for (const { name, rate, fps, drop } of RATES) {
    it(`${name}: every frame of two hours reads the same, and our parser returns the frame the reference counts`, () => {
      expect(describeRate(rate).dropFrame).toBe(drop);
      const total = describeRate(rate).nominal * 7200;
      for (let frame = 0; frame < total; frame += 1) {
        const ours = formatTimecode(frame, rate);
        const theirs = Timecode(frame, fps, drop).toString();
        if (ours !== theirs) throw new Error(`${name}: frame ${frame}: ours ${ours}, reference ${theirs}`);
        if (frame % 211 === 0 && parseTimecode(ours, rate) !== Timecode(theirs, fps, drop).frameCount) throw new Error(`${name}: ${ours} parses differently`);
      }
      expect(true).toBe(true);
    }, 60_000);
  }
});
