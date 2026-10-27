import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, Pause } from "lucide-react";
import { autoCorrelate, freqToNote } from "@/lib/audio-tools";
import { INSTRUMENTS, getInstrument, type InstrumentId } from "@/lib/transpose";

export const Route = createFileRoute("/afinador")({
  head: () => ({
    meta: [
      { title: "Afinador Cromático — Octava" },
      { name: "description", content: "Afinador cromático pelo microfone com leitura para Sax Alto, Sax Tenor, Trompa e Som Real." },
      { property: "og:title", content: "Afinador Cromático — Octava" },
      { property: "og:description", content: "Afine seu instrumento com precisão de ±3 cents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Afinador,
});

const ORDER: InstrumentId[] = ["c", "eb", "bb", "f"];

function Afinador() {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [inst, setInst] = useState<InstrumentId>("c");
  const [freq, setFreq] = useState<number | null>(null);
  const ref = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  const stop = () => {
    const r = ref.current;
    if (r) { cancelAnimationFrame(r.raf); r.stream.getTracks().forEach((t) => t.stop()); void r.ctx.close(); }
    ref.current = null; setOn(false);
  };

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser(); an.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let smooth = 0;
      const loop = () => {
        an.getFloatTimeDomainData(buf);
        const f = autoCorrelate(buf, ctx.sampleRate);
        if (f > 25 && f < 4200) { smooth = smooth && Math.abs(f - smooth) / smooth < 0.05 ? smooth * 0.7 + f * 0.3 : f; setFreq(smooth); }
        ref.current!.raf = requestAnimationFrame(loop);
      };
      ref.current = { ctx, stream, raf: 0 };
      setOn(true); loop();
    } catch { setErr("Não foi possível acessar o microfone. Verifique a permissão do navegador."); }
  };

  useEffect(() => stop, []);

  const n = freq ? freqToNote(freq, getInstrument(inst).offset) : null;
  const cents = n?.cents ?? 0;
  const inTune = !!n && Math.abs(cents) <= 3;
  const color = !n ? "var(--muted-foreground)" : inTune ? "var(--success)" : Math.abs(cents) <= 15 ? "var(--primary)" : "var(--destructive)";
  const angle = (Math.max(-50, Math.min(50, cents)) / 50) * 60;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-28 pt-6 animate-in fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Afinador</h1>
      <p className="text-sm text-muted-foreground">A nota mostrada é a que você lê no seu instrumento.</p>

      <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-2xl border border-border/70 bg-card p-1.5">
        {ORDER.map((id) => { const i = INSTRUMENTS.find((x) => x.id === id)!; return (
          <button key={id} onClick={() => setInst(id)} className={`rounded-xl px-1 py-2 text-center transition active:scale-95 ${inst === id ? "bg-gold text-primary-foreground shadow-glow" : "text-muted-foreground"}`}>
            <div className="font-display text-sm font-bold">{i.key}</div>
            <div className="truncate text-[10px]">{id === "c" ? "Som Real" : id === "eb" ? "Sax Alto" : id === "bb" ? "Sax Tenor" : "Trompa"}</div>
          </button>
        ); })}
      </div>

      <section className="relative mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-layer">
        <svg viewBox="0 0 300 180" className="w-full">
          <path d="M 30 160 A 120 120 0 0 1 270 160" fill="none" stroke="var(--secondary)" strokeWidth="14" strokeLinecap="round" />
          {Array.from({ length: 21 }, (_, k) => { const a = ((k - 10) / 10) * 60 * (Math.PI / 180); const big = k % 5 === 0;
            return <line key={k} x1={150 + Math.sin(a) * (big ? 96 : 102)} y1={160 - Math.cos(a) * (big ? 96 : 102)} x2={150 + Math.sin(a) * 110} y2={160 - Math.cos(a) * 110} stroke={k === 10 ? "var(--success)" : "var(--muted-foreground)"} strokeWidth={big ? 2.5 : 1.2} opacity={big ? 0.9 : 0.5} />; })}
          <text x="38" y="178" fill="var(--muted-foreground)" fontSize="11">-50</text>
          <text x="248" y="178" fill="var(--muted-foreground)" fontSize="11">+50</text>
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "150px 160px", transition: "transform 120ms linear" }}>
            <line x1="150" y1="160" x2="150" y2="48" stroke={color} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
          </g>
          <circle cx="150" cy="160" r="9" fill={color} />
        </svg>
        <div className="-mt-2 text-center">
          <div className="font-display text-7xl font-bold leading-none transition-colors" style={{ color }}>
            {n ? n.name.replace("#", "♯").replace("b", "♭") : "—"}<span className="text-2xl text-muted-foreground">{n?.octave}</span>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{freq ? `${freq.toFixed(1)} Hz` : "— Hz"} · <span style={{ color }}>{n ? `${cents > 0 ? "+" : ""}${cents} cents` : "toque uma nota"}</span></div>
          <div className="mt-1 h-5 text-sm font-semibold" style={{ color }}>{n ? (inTune ? "Afinado ✓" : cents < 0 ? "Baixo — suba" : "Alto — desça") : ""}</div>
        </div>
      </section>

      {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}

      <button onClick={on ? stop : start} className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-display text-base font-semibold transition active:scale-[0.98] ${on ? "border border-border bg-secondary text-foreground" : "bg-gold text-primary-foreground shadow-glow"}`}>
        {on ? <><Pause className="h-5 w-5" /> Pausar Afinador</> : <><Mic className="h-5 w-5" /> Ativar Afinador</>}
      </button>
    </main>
  );
}
