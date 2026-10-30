import { describe, expect, it } from "vitest";
import type { MusicTrack } from "@/types";
import { trackLengthSeconds } from "./music-synth";

describe("trackLengthSeconds", () => {
  it("ends with the last note of any channel", () => {
    const track = {
      bpm: 120,
      channels: [{ patterns: [{ notes: [{ start: 0, duration: 4 }, { start: 6, duration: 2 }] }] }],
    } as MusicTrack;
    expect(trackLengthSeconds(track)).toBe(4);
  });

  it("is zero without channels", () => {
    expect(trackLengthSeconds({ bpm: 120, channels: [] } as unknown as MusicTrack)).toBe(0);
  });
});
