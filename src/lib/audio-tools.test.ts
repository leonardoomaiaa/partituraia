import { describe, it, expect } from "vitest";
import { freqToNote, tempoName, clampBpm } from "./audio-tools";

describe("afinador", () => {
  it("440 Hz é A4 afinado em Som Real", () => expect(freqToNote(440)).toEqual({ name: "A", octave: 4, cents: 0 }));
  it("Concert A lido no Sax Alto (Eb) é F#", () => expect(freqToNote(440, 9).name).toBe("F#"));
  it("Concert C lido no Sax Tenor (Bb) é D", () => expect(freqToNote(261.63, 2).name).toBe("D"));
  it("Concert C lido na Trompa (F) é G", () => expect(freqToNote(261.63, 7).name).toBe("G"));
});

describe("metrônomo", () => {
  it("BPM limitado entre 40 e 250", () => { expect(clampBpm(10)).toBe(40); expect(clampBpm(300)).toBe(250); });
  it("nomes de andamento", () => { expect(tempoName(50)).toBe("Largo"); expect(tempoName(112)).toBe("Moderato"); expect(tempoName(200)).toBe("Presto"); });
});
