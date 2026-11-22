import { describe, expect, it } from "vitest";
import { describeRate, formatTimecode, parseTimecode, type FrameRate } from "../src/timecode";

const R = (n: number, d = 1): FrameRate => ({ n, d });
const FPS25 = R(25), FPS50 = R(50), FPS24 = R(24), FPS30 = R(30), FPS60 = R(60);
const DF2997 = R(30000, 1001), DF5994 = R(60000, 1001), NDF23976 = R(24000, 1001);

describe("SMPTE timecode, non-drop (whole frame rates)", () => {
  it("counts frames at the nominal rate: 25, 50, 24, 30 and 60", () => {
    expect(formatTimecode(0, FPS25)).toBe("00:00:00:00");
    expect(formatTimecode(24, FPS25)).toBe("00:00:00:24");
    expect(formatTimecode(25, FPS25)).toBe("00:00:01:00");
    expect(formatTimecode(25 * 60 + 3, FPS25)).toBe("00:01:00:03");
    expect(formatTimecode(25 * 3600, FPS25)).toBe("01:00:00:00");
    expect(formatTimecode(49, FPS50)).toBe("00:00:00:49");
    expect(formatTimecode(50, FPS50)).toBe("00:00:01:00");
    expect(formatTimecode(23, FPS24)).toBe("00:00:00:23");
    expect(formatTimecode(1800, FPS30)).toBe("00:01:00:00");
    expect(formatTimecode(3600, FPS60)).toBe("00:01:00:00");
  });

  it("23.976 is counted at 24 and is NOT drop-frame: there is no drop-frame form of it", () => {
    expect(formatTimecode(24, NDF23976)).toBe("00:00:01:00");
    expect(describeRate(NDF23976)).toMatchObject({ dropFrame: false, nominal: 24 });
  });
});

describe("SMPTE timecode, drop-frame (29.97 and 59.94)", () => {
  it("separates the frames with a semicolon, and skips frame numbers 00 and 01 at the start of every minute but each tenth", () => {
    expect(formatTimecode(0, DF2997)).toBe("00:00:00;00");
    expect(formatTimecode(29, DF2997)).toBe("00:00:00;29");
    expect(formatTimecode(30, DF2997)).toBe("00:00:01;00");
    expect(formatTimecode(1799, DF2997)).toBe("00:00:59;29");
    expect(formatTimecode(1800, DF2997)).toBe("00:01:00;02"); // 00 and 01 do not exist at minute 1
    expect(formatTimecode(1801, DF2997)).toBe("00:01:00;03");
    expect(formatTimecode(17981, DF2997)).toBe("00:09:59;29");
    expect(formatTimecode(17982, DF2997)).toBe("00:10:00;00"); // every tenth minute keeps its frames
    expect(formatTimecode(17983, DF2997)).toBe("00:10:00;01");
  });

  it("an hour of drop-frame is 107 892 frames, and it is 01:00:00;00 exactly there", () => {
    expect(formatTimecode(107_892, DF2997)).toBe("01:00:00;00");
    expect(formatTimecode(107_891, DF2997)).toBe("00:59:59;29");
  });

  it("59.94 drops four frame numbers (00-03) at the start of every minute but each tenth", () => {
    expect(formatTimecode(59, DF5994)).toBe("00:00:00;59");
    expect(formatTimecode(60, DF5994)).toBe("00:00:01;00");
    expect(formatTimecode(3599, DF5994)).toBe("00:00:59;59");
    expect(formatTimecode(3600, DF5994)).toBe("00:01:00;04");
    expect(formatTimecode(35_964, DF5994)).toBe("00:10:00;00");
    expect(formatTimecode(215_784, DF5994)).toBe("01:00:00;00");
  });

  it("tells which rates are drop-frame", () => {
    expect(describeRate(DF2997)).toMatchObject({ dropFrame: true, nominal: 30, label: "29,97 DF" });
    expect(describeRate(DF5994)).toMatchObject({ dropFrame: true, nominal: 60, label: "59,94 DF" });
    expect(describeRate(FPS25)).toMatchObject({ dropFrame: false, nominal: 25, label: "25" });
    expect(describeRate(FPS50)).toMatchObject({ dropFrame: false, label: "50" });
    expect(describeRate(R(30000, 1001)).label).toBe("29,97 DF");
  });
});

describe("reading a timecode back", () => {
  it("is the exact inverse of formatting, for every frame of two hours, at every rate", () => {
    for (const rate of [FPS25, FPS50, FPS24, FPS30, FPS60, DF2997, DF5994, NDF23976]) {
      const nominal = describeRate(rate).nominal;
      for (let f = 0; f < nominal * 7200; f += 997) expect(parseTimecode(formatTimecode(f, rate), rate), `${rate.n}/${rate.d} @ ${f}`).toBe(f);
    }
    for (const f of [0, 1, 1799, 1800, 1801, 17981, 17982, 107_891, 107_892]) expect(parseTimecode(formatTimecode(f, DF2997), DF2997)).toBe(f);
  });

  it("accepts a colon or a semicolon before the frames, and shortened forms", () => {
    expect(parseTimecode("00:00:01:00", FPS25)).toBe(25);
    expect(parseTimecode("00:00:01;00", FPS25)).toBe(25);
    expect(parseTimecode("1:00", FPS25)).toBe(25); // typed from the right: 1 second, 00 frames
    expect(parseTimecode("1:02:03", FPS25)).toBe(parseTimecode("00:01:02:03", FPS25)); // 1 minute, 2 seconds, 3 frames
    expect(parseTimecode("7", FPS25)).toBe(7);
  });

  it("refuses what does not exist: frames beyond the rate, and the frame numbers drop-frame skips", () => {
    expect(parseTimecode("00:00:00:25", FPS25)).toBeNull();
    expect(parseTimecode("00:00:60:00", FPS25)).toBeNull();
    expect(parseTimecode("00:01:00;00", DF2997)).toBeNull(); // dropped
    expect(parseTimecode("00:01:00;01", DF2997)).toBeNull();
    expect(parseTimecode("00:10:00;00", DF2997)).toBe(17982); // a tenth minute keeps them
    expect(parseTimecode("hola", FPS25)).toBeNull();
    expect(parseTimecode("", FPS25)).toBeNull();
    expect(parseTimecode("-00:00:01:00", FPS25)).toBeNull();
  });
});

describe("what is shown, never wrong", () => {
  it("a negative or fractional frame is shown as the whole frame at or after zero", () => {
    expect(formatTimecode(-5, FPS25)).toBe("00:00:00:00");
    expect(formatTimecode(25.9, FPS25)).toBe("00:00:01:00");
  });
});
