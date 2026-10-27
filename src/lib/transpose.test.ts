import { describe, it, expect } from "vitest";
import { transposeNote } from "./transpose";

describe("transposição", () => {
  it("Bb: +2 semitons", () => {
    expect(["C", "G", "F"].map((n) => transposeNote(n, 2))).toEqual(["D", "A", "G"]);
  });
  it("Eb: +9 semitons", () => {
    expect(["C", "F", "G"].map((n) => transposeNote(n, 9))).toEqual(["A", "D", "E"]);
  });
  it("F: +7 semitons", () => {
    expect(["C", "F"].map((n) => transposeNote(n, 7))).toEqual(["G", "C"]);
  });
  it("C: mantém", () => {
    expect(transposeNote("E", 0)).toBe("E");
  });
  it("acidentes", () => {
    expect(transposeNote("Bb", 2)).toBe("C");
    expect(transposeNote("F#", 2)).toBe("G#");
  });
});

import { transposeBetween, relativeOffset, intervalName } from "./transpose";
describe("entre afinações", () => {
  it("Sax Alto (Eb) → Sax Tenor (Bb): +5 semitons, 4ª justa", () => {
    expect(relativeOffset("eb", "bb")).toBe(5);
    expect(intervalName(5)).toBe("4ª justa");
    expect(transposeBetween(["A", "D"], "eb", "bb")).toEqual(["D", "G"]);
  });
  it("Bb → Som Real: -2", () => {
    expect(transposeBetween(["D"], "bb", "c")).toEqual(["C"]);
  });
  it("Som Real → Eb", () => {
    expect(transposeBetween(["C", "F", "G"], "c", "eb")).toEqual(["A", "D", "E"]);
  });
});
