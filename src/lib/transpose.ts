export const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export const NOTE_NAMES: Record<string, string> = {
  C: "Dó", D: "Ré", E: "Mi", F: "Fá", G: "Sol", A: "Lá", B: "Si",
};

export type InstrumentId = "eb" | "bb" | "f" | "c";

export const INSTRUMENTS: { id: InstrumentId; label: string; short: string; tuning: string; key: string; offset: number }[] = [
  { id: "c", label: "Flauta / Tuba / Teclado / Som Real", short: "Som Real", tuning: "Dó (C)", key: "C", offset: 0 },
  { id: "bb", label: "Sax Tenor / Trompete / Clarinete", short: "Sax Tenor · Trompete", tuning: "Si♭ (Bb)", key: "B♭", offset: 2 },
  { id: "eb", label: "Sax Alto / Sax Barítono", short: "Sax Alto · Barítono", tuning: "Mi♭ (Eb)", key: "E♭", offset: 9 },
  { id: "f", label: "Trompa", short: "Trompa", tuning: "Fá (F)", key: "F", offset: 7 },
];

export const getInstrument = (id: InstrumentId) => INSTRUMENTS.find((i) => i.id === id)!;

export function noteIndex(note: string): number {
  const base = "CDEFGAB".indexOf(note.charAt(0));
  if (base < 0) throw new Error(`Nota inválida: ${note}`);
  const semis = [0, 2, 4, 5, 7, 9, 11][base] ?? 0;
  let acc = 0;
  for (const ch of note.slice(1)) acc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return (((semis + acc) % 12) + 12) % 12;
}

export function transposeNote(note: string, offset: number, useFlats = note.includes("b")): string {
  const idx = (((noteIndex(note) + offset) % 12) + 12) % 12;
  return (useFlats ? FLATS : SHARPS)[idx] ?? note;
}

export function transposeNotes(notes: string[], offset: number): string[] {
  return notes.map((n) => transposeNote(n, offset));
}

/** Semitons a somar para ir da leitura na afinação de origem para a de destino (0–11). */
export function relativeOffset(from: InstrumentId, to: InstrumentId): number {
  return (((getInstrument(to).offset - getInstrument(from).offset) % 12) + 12) % 12;
}

export function transposeBetween(notes: string[], from: InstrumentId, to: InstrumentId): string[] {
  return transposeNotes(notes, relativeOffset(from, to));
}

const INTERVALS = ["Uníssono", "2ª menor", "2ª maior", "3ª menor", "3ª maior", "4ª justa", "Trítono", "5ª justa", "6ª menor", "6ª maior", "7ª menor", "7ª maior"];
export function intervalName(semis: number): string {
  return INTERVALS[((semis % 12) + 12) % 12]!;
}
