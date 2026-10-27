import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, RotateCcw, Clock, ArrowDown, FileDown } from "lucide-react";
import { toast } from "sonner";
import { getInstrument, intervalName, relativeOffset, transposeBetween } from "@/lib/transpose";
import { addHistory, getSession, setSession, type Session } from "@/lib/store";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { PaywallModal } from "@/components/PaywallModal";
import { ProBadge } from "@/components/ProBadge";
import { useSubscription } from "@/lib/use-subscription";
import { exportTranspositionPdf } from "@/lib/pdf";

export const Route = createFileRoute("/resultado")({
  head: () => ({
    meta: [
      { title: "Resultado da Transposição — Octava" },
      { name: "description", content: "Compare as notas originais e transpostas e copie a sequência." },
      { property: "og:title", content: "Resultado da Transposição — Octava" },
      { property: "og:description", content: "Notas transpostas entre Eb, Bb, F e C." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resultado,
});

const pretty = (n: string) => n.replace("#", "♯").replace("b", "♭");

function Resultado() {
  const [s, setS] = useState<Session | null>(null);
  const [paywall, setPaywall] = useState(false);
  const navigate = useNavigate();
  const saved = useRef(false);
  const sub = useSubscription();

  useEffect(() => {
    const cur = getSession();
    if (!cur.notes.length) {
      navigate({ to: "/teclado" });
      return;
    }
    setS(cur);
    if (sub.loading || saved.current) return;
    saved.current = true;
    const result = addHistory(
      { original: cur.notes, result: transposeBetween(cur.notes, cur.from, cur.to), from: cur.from, to: cur.to },
      sub.plan,
    );
    if (!result.ok) {
      setPaywall(true);
      toast(`Você já guardou ${sub.freeLimit} músicas no plano gratuito.`);
    }
  }, [navigate, sub.loading, sub.plan, sub.freeLimit]);

  if (!s) return <main className="min-h-screen" />;
  const from = getInstrument(s.from), to = getInstrument(s.to);
  const result = transposeBetween(s.notes, s.from, s.to);
  const semis = relativeOffset(s.from, s.to);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.join(" - "));
      toast.success("Copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const exportPdf = async () => {
    if (!sub.isPro) {
      setPaywall(true);
      return;
    }
    try {
      await exportTranspositionPdf({
        original: s.notes,
        result,
        fromLabel: from.label,
        toLabel: to.label,
        fromTuning: from.tuning,
        toTuning: to.tuning,
        interval: `${semis} ${semis === 1 ? "semitom" : "semitons"} · ${intervalName(semis)}`,
      });
      toast.success("PDF gerado!");
    } catch {
      toast.error("Não foi possível gerar o PDF");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-4 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center gap-2">
        <Link to="/teclado" className="rounded-xl p-2 transition hover:bg-muted active:scale-95" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Resultado</h1>
      </div>

      <section className="mt-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-layer">
        <div className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notas originais · {from.tuning}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{from.label}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {s.notes.map((n, i) => <span key={i} className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 font-display text-base text-muted-foreground">{pretty(n)}</span>)}
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="h-px w-full bg-border" />
          <span className="absolute flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
            <ArrowDown className="h-3 w-3 text-primary" /> Deslocamento: {semis} {semis === 1 ? "semitom" : "semitons"} / {intervalName(semis)}
          </span>
        </div>
        <div className="bg-gradient-to-b from-success/10 to-transparent p-5 pt-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Notas transpostas · {to.tuning}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{to.label}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.map((n, i) => (
              <span key={i} style={{ animationDelay: `${i * 40}ms` }} className="rounded-xl border border-success/30 bg-success/10 px-3 py-1.5 font-display text-2xl font-bold text-success animate-in zoom-in-90 fill-mode-both">{pretty(n)}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2.5">
        <button onClick={copy} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-gold py-4 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98]">
          <Copy className="h-5 w-5" /> Copiar Sequência
        </button>
        <button onClick={exportPdf} className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 py-3.5 text-sm font-semibold transition active:scale-[0.98]">
          <FileDown className="h-4 w-4" /> Exportar PDF <ProBadge />
        </button>
        <button onClick={() => { setSession({ ...s, notes: [] }); navigate({ to: "/teclado" }); }} className="glass flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition active:scale-95">
          <RotateCcw className="h-4 w-4" /> Nova Transposição
        </button>
        <HistoryDrawer>
          <button className="glass flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition active:scale-95">
            <Clock className="h-4 w-4" /> Ver Histórico
          </button>
        </HistoryDrawer>
      </section>

      <PaywallModal
        open={paywall}
        onOpenChange={setPaywall}
        reason={
          sub.plan === "free"
            ? "O plano gratuito guarda até 10 músicas. O PRO libera o histórico ilimitado e a exportação em PDF."
            : "A exportação em PDF é exclusiva do plano PRO."
        }
      />
    </main>
  );
}
