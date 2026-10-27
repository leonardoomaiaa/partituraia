import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Undo2, Trash2, X, ArrowLeftRight } from "lucide-react";
import { NOTE_NAMES, type InstrumentId } from "@/lib/transpose";
import { getSession, setSession, type Session } from "@/lib/store";
import { InstrumentSelect } from "@/components/InstrumentSelect";

export const Route = createFileRoute("/teclado")({
  head: () => ({
    meta: [
      { title: "Entrada de Notas — Octava" },
      { name: "description", content: "Digite a melodia, escolha a afinação de origem e destino e transponha." },
      { property: "og:title", content: "Entrada de Notas — Octava" },
      { property: "og:description", content: "Teclado musical rápido com sustenidos e bemóis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Teclado,
});

function Teclado() {
  const [s, setS] = useState<Session>({ notes: [], from: "c", to: "eb" });
  const [pending, setPending] = useState<"#" | "b" | null>(null);
  const navigate = useNavigate();

  useEffect(() => setS(getSession()), []);
  const update = (patch: Partial<Session>) => { const n = { ...s, ...patch }; setS(n); setSession(n); };
  const notes = s.notes;

  const addNote = (n: string) => { update({ notes: [...notes, n + (pending ?? "")] }); setPending(null); };
  const accidental = (a: "#" | "b") => {
    const last = notes[notes.length - 1];
    if (last && last.length === 1 && !pending) update({ notes: [...notes.slice(0, -1), last + a] });
    else setPending(pending === a ? null : a);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28 pt-4 animate-in fade-in">
      <div className="flex items-center gap-2">
        <Link to="/" className="rounded-xl p-2 transition hover:bg-muted active:scale-95" aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-lg font-semibold">Entrada Manual</h1>
      </div>

      <section className="glass mt-3 flex items-end gap-2 rounded-2xl p-3">
        <InstrumentSelect label="De" value={s.from} onChange={(v: InstrumentId) => update({ from: v })} />
        <button onClick={() => update({ from: s.to, to: s.from })} aria-label="Inverter"
          className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-primary transition active:scale-90 active:rotate-180">
          <ArrowLeftRight className="h-4 w-4" />
        </button>
        <InstrumentSelect label="Para" value={s.to} onChange={(v: InstrumentId) => update({ to: v })} />
      </section>

      <section className="mt-3 rounded-2xl border border-border/70 bg-card p-3 shadow-layer">
        <div className="flex min-h-24 flex-wrap content-start gap-1.5 rounded-xl bg-background/60 p-2.5">
          {notes.length ? notes.map((n, i) => (
            <button key={i} onClick={() => update({ notes: notes.filter((_, j) => j !== i) })}
              className="group flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1.5 font-display text-base font-semibold text-primary transition active:scale-90 animate-in zoom-in-75">
              {n.replace("#", "♯").replace("b", "♭")} <X className="h-3 w-3 opacity-50" />
            </button>
          )) : <span className="p-1 text-sm text-muted-foreground">Toque nas notas abaixo…</span>}
        </div>
        <div className="mt-2 flex justify-end gap-1">
          <button onClick={() => update({ notes: notes.slice(0, -1) })} disabled={!notes.length} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted active:scale-95 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" /> Desfazer</button>
          <button onClick={() => update({ notes: [] })} disabled={!notes.length} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted active:scale-95 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /> Limpar Tudo</button>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-4 gap-2.5">
        {Object.entries(NOTE_NAMES).map(([c, n]) => (
          <button key={c} onClick={() => addNote(c)} className="key flex aspect-square flex-col items-center justify-center rounded-2xl">
            <span className="font-display text-2xl font-bold">{c}{pending === "#" ? "♯" : pending === "b" ? "♭" : ""}</span>
            <span className="text-[11px] text-muted-foreground">{n}</span>
          </button>
        ))}
        <div className="col-span-1" />
        {(["#", "b"] as const).map((a) => (
          <button key={a} onClick={() => accidental(a)}
            className={`col-span-2 flex items-center justify-center gap-2 rounded-2xl border py-3 transition active:scale-95 ${pending === a ? "border-primary bg-primary/15 text-primary" : "border-border bg-card"}`}>
            <span className="font-display text-2xl font-bold">{a === "#" ? "♯" : "♭"}</span>
            <span className="text-xs text-muted-foreground">{a === "#" ? "Sustenido" : "Bemol"}</span>
          </button>
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button disabled={!notes.length} onClick={() => navigate({ to: "/resultado" })}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 font-display text-base font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none">
            Transpor Notas Agora <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </main>
  );
}
