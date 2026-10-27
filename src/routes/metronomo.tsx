import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Square, Hand } from "lucide-react";
import { clampBpm, tempoName } from "@/lib/audio-tools";

export const Route = createFileRoute("/metronomo")({
  head: () => ({
    meta: [
      { title: "Metrônomo Digital — Octava" },
      { name: "description", content: "Metrônomo preciso de 40 a 250 BPM com Tap Tempo e compassos 2/4, 3/4, 4/4 e 6/8." },
      { property: "og:title", content: "Metrônomo Digital — Octava" },
      { property: "og:description", content: "Estude no tempo certo com cliques precisos e acento no primeiro tempo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Metronomo,
});

const SIGS = [{ l: "2/4", b: 2 }, { l: "3/4", b: 3 }, { l: "4/4", b: 4 }, { l: "6/8", b: 6 }];

function Metronomo() {
  const [bpm, setBpmS] = useState(100);
  const [beats, setBeats] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const cfg = useRef({ bpm, beats });
  cfg.current = { bpm, beats };
  const eng = useRef<{ ctx: AudioContext; timer: number; next: number; i: number } | null>(null);
  const taps = useRef<number[]>([]);
  const setBpm = (b: number) => setBpmS(clampBpm(b));

  const stop = () => {
    const e = eng.current; if (e) { clearInterval(e.timer); void e.ctx.close(); }
    eng.current = null; setPlaying(false); setBeat(-1);
  };

  const start = () => {
    const ctx = new AudioContext();
    const e = { ctx, timer: 0, next: ctx.currentTime + 0.06, i: 0 };
    const click = (t: number, accent: boolean) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = accent ? 1760 : 1000;
      g.gain.setValueAtTime(accent ? 0.9 : 0.45, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.05);
    };
    e.timer = window.setInterval(() => {
      while (e.next < ctx.currentTime + 0.1) {
        const { bpm: b, beats: n } = cfg.current;
        const idx = e.i % n;
        click(e.next, idx === 0);
        const delay = Math.max(0, (e.next - ctx.currentTime) * 1000);
        setTimeout(() => setBeat(idx), delay);
        e.next += (60 / b) * (n === 6 ? 0.5 : 1);
        e.i++;
      }
    }, 25);
    eng.current = e; setPlaying(true);
  };

  useEffect(() => stop, []);
  useEffect(() => { if (eng.current) eng.current.i = 0; }, [beats]);

  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 2500).concat(now).slice(-6);
    taps.current = t;
    if (t.length >= 2) { const avg = (t[t.length - 1]! - t[0]!) / (t.length - 1); setBpm(60000 / avg); }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-6 animate-in fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Metrônomo</h1>
      <p className="text-sm text-muted-foreground">Primeiro tempo acentuado, cliques precisos.</p>

      <section className="mt-5 rounded-3xl border border-border/70 bg-card p-5 text-center shadow-layer">
        <div className="flex justify-center gap-2.5">
          {Array.from({ length: beats }, (_, i) => (
            <span key={i} className={`h-4 w-4 rounded-full transition-all duration-75 ${beat === i ? (i === 0 ? "scale-125 bg-success shadow-[0_0_16px_var(--success)]" : "scale-110 bg-primary shadow-glow") : "bg-secondary"}`} />
          ))}
        </div>
        <div className="mt-5 font-display text-7xl font-bold leading-none tabular-nums">{bpm}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">BPM</div>
        <div className="mt-2 font-display text-lg italic text-primary">{tempoName(bpm)}</div>

        <input type="range" min={40} max={250} value={bpm} onChange={(e) => setBpm(+e.target.value)} className="mt-5 w-full accent-[var(--primary)]" aria-label="BPM" />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[-5, -1, 1, 5].map((d) => (
            <button key={d} onClick={() => setBpm(bpm + d)} className="key rounded-xl py-2.5 font-display font-semibold">{d > 0 ? `+${d}` : d}</button>
          ))}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-border/70 bg-card p-1.5">
        {SIGS.map((s) => (
          <button key={s.l} onClick={() => setBeats(s.b)} className={`rounded-xl py-2 font-display font-bold transition active:scale-95 ${beats === s.b ? "bg-gold text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>{s.l}</button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={tap} className="key flex h-20 flex-1 flex-col items-center justify-center rounded-2xl">
          <Hand className="h-5 w-5 text-primary" /><span className="mt-1 text-sm font-semibold">Tap Tempo</span>
        </button>
        <button onClick={playing ? stop : start} aria-label={playing ? "Parar" : "Tocar"}
          className={`flex h-20 w-28 items-center justify-center rounded-2xl transition active:scale-95 ${playing ? "border border-border bg-secondary" : "bg-gold text-primary-foreground shadow-glow"}`}>
          {playing ? <Square className="h-8 w-8 fill-current" /> : <Play className="h-9 w-9 fill-current" />}
        </button>
      </div>
    </main>
  );
}
