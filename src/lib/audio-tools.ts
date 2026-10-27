const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** Converte frequência em nota lida no instrumento (offset = semitons da afinação, ex.: Eb = 9). */
export function freqToNote(freq: number, offset = 0, a4 = 440) {
  const midiExact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(midiExact);
  const cents = Math.round((midiExact - midi) * 100);
  const written = midi + offset;
  return { name: NAMES[((written % 12) + 12) % 12]!, octave: Math.floor(written / 12) - 1, cents };
}

export function tempoName(bpm: number): string {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 168) return "Allegro";
  return "Presto";
}

export const clampBpm = (b: number) => Math.min(250, Math.max(40, Math.round(b)));

/** Detecção de pitch por autocorrelação. Retorna -1 se não houver sinal. */
export function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += buf[i]! * buf[i]!;
  if (Math.sqrt(rms / size) < 0.01) return -1;
  let r1 = 0, r2 = size - 1;
  const thr = 0.2;
  for (let i = 0; i < size / 2; i++) if (Math.abs(buf[i]!) < thr) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++) if (Math.abs(buf[size - i]!) < thr) { r2 = size - i; break; }
  const b = buf.slice(r1, r2);
  size = b.length;
  const c = new Array<number>(size).fill(0);
  for (let i = 0; i < size; i++) for (let j = 0; j < size - i; j++) c[i]! += b[j]! * b[j + i]!;
  let d = 0;
  while (d < size - 1 && c[d]! > c[d + 1]!) d++;
  let max = -1, pos = -1;
  for (let i = d; i < size; i++) if (c[i]! > max) { max = c[i]!; pos = i; }
  if (pos <= 0) return -1;
  const x1 = c[pos - 1] ?? 0, x2 = c[pos]!, x3 = c[pos + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  const t = a ? pos - bb / (2 * a) : pos;
  return sampleRate / t;
}
