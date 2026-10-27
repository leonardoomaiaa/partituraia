import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Camera,
  Clock,
  History,
  Keyboard,
  ArrowRight,
  Check,
  ScanLine,
  Sparkles,
  User,
} from "lucide-react";
import { HistoryDrawer } from "@/components/HistoryDrawer";
import { ProBadge } from "@/components/ProBadge";
import { PaywallModal } from "@/components/PaywallModal";
import { useAuth } from "@/lib/auth-context";
import { useSubscription } from "@/lib/use-subscription";
import { PRO_PERKS, PRO_PRICES } from "@/lib/billing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Octava — Transpositor Musical" },
      {
        name: "description",
        content:
          "Transponha músicas para Eb, Bb, F e C digitando as notas ou fotografando a partitura.",
      },
      { property: "og:title", content: "Octava — Transpositor Musical" },
      {
        property: "og:description",
        content: "Transposição instantânea para instrumentos em Eb, Bb, F e C.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const pretty = (n: string) => n.replace("#", "♯").replace("b", "♭");

function AccountButton() {
  const { user, loading } = useAuth();
  const { plan } = useSubscription();

  if (loading) {
    return <span className="h-8 w-20 animate-pulse rounded-full border border-border/60" />;
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold transition active:scale-95"
      >
        <User className="h-3.5 w-3.5" /> Entrar
      </Link>
    );
  }

  return (
    <Link
      to="/conta"
      className="flex items-center gap-1.5 rounded-full border border-border/70 py-1.5 pl-1.5 pr-3 text-xs font-semibold transition active:scale-95"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-primary-foreground">
        {(user.email ?? "?").charAt(0).toUpperCase()}
      </span>
      Minha Conta
      <span
        className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
          plan === "pro" ? "bg-gold text-primary-foreground" : "border border-border text-muted-foreground"
        }`}
      >
        {plan === "pro" ? "PRO" : "FREE"}
      </span>
    </Link>
  );
}

function Index() {
  const [preview, setPreview] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const sub = useSubscription();

  const last = localStorage.getItem("octava-history");
  let lastItem: { original: string[]; result: string[]; ts: number } | null = null;
  try {
    const parsed = last ? (JSON.parse(last) as Array<{ original: string[]; result: string[]; ts: number }>) : [];
    lastItem = parsed[0] ?? null;
  } catch {
    lastItem = null;
  }

  const openScanner = () => {
    if (!sub.isPro) {
      setPaywall(true);
      return;
    }
    setPreview(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-28 pt-4 animate-in fade-in">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gold text-primary-foreground shadow-glow">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Octava</span>
        </div>
        <div className="flex items-center gap-2">
          <HistoryDrawer>
            <button
              className="flex items-center gap-1.5 rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium transition active:scale-95"
              aria-label="Abrir histórico"
            >
              <History className="h-3.5 w-3.5" />
              Histórico
              {lastItem && (
                <span className="ml-0.5 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                  {JSON.parse(last).length}
                </span>
              )}
            </button>
          </HistoryDrawer>
          <AccountButton />
        </div>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-2xl font-bold leading-tight">
          O que você vai
          <br />
          <span className="bg-gradient-to-r from-[oklch(0.85_0.14_80)] to-[oklch(0.7_0.17_55)] bg-clip-text text-transparent">
            tocar hoje?
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Transposição instantânea para instrumentos em Eb, Bb, F e C.
        </p>
      </section>

      <section className="mt-6 space-y-3">
        <Link
          to="/teclado"
          className="group block overflow-hidden rounded-3xl border border-border/70 bg-card shadow-layer transition active:scale-[0.98]"
        >
          <div className="flex items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-primary transition group-hover:scale-105">
              <Keyboard className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">Entrada Manual</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Toque as notas no teclado virtual e transponha na hora.
              </p>
              <div className="mt-3 flex gap-1">
                {["D", "E", "F", "G", "A"].map((n, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-6 rounded-full bg-gold opacity-60"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </Link>

        <button
          onClick={openScanner}
          className="group block w-full overflow-hidden rounded-3xl border border-border/70 bg-card shadow-layer transition active:scale-[0.98]"
        >
          <div className="flex items-start gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-secondary/60 text-primary transition group-hover:scale-105">
              <Camera className="h-6 w-6" />
            </span>
            <div className="min-w-0 text-left">
              <h2 className="flex items-center gap-2 font-semibold">
                Digitalizar Partitura <ProBadge />
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Fotografe a partitura e deixe a leitura das notas por conta do app.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <ScanLine className="h-3 w-3" /> Scanner OMR
              </div>
            </div>
            <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </button>
      </section>

      {lastItem && (
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Última transposição
          </h3>
          <Link
            to="/teclado"
            className="block rounded-2xl border border-border/60 bg-secondary/40 p-4 transition active:scale-[0.98]"
          >
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{new Date(lastItem.ts).toLocaleDateString("pt-BR")}</span>
              <span className="flex items-center gap-1 text-primary">
                Reutilizar <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lastItem.original.slice(0, 6).map((n, i) => (
                <span key={i} className="rounded-md bg-card px-2 py-0.5 text-xs text-muted-foreground">
                  {pretty(n)}
                </span>
              ))}
              <span className="self-center text-muted-foreground">→</span>
              {lastItem.result.slice(0, 6).map((n, i) => (
                <span key={i} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                  {pretty(n)}
                </span>
              ))}
            </div>
          </Link>
        </section>
      )}

      {!sub.isPro && (
        <section className="mt-6 overflow-hidden rounded-3xl border border-primary/35 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            Octava PRO <ProBadge />
          </h3>
          <ul className="mt-3 space-y-1.5">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-xs text-foreground/85">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} /> {perk}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setPaywall(true)}
            className="mt-4 w-full rounded-2xl bg-gold py-3 text-sm font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98]"
          >
            Assinar por {PRO_PRICES.month.label}
          </button>
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-card p-6 text-center shadow-layer animate-in zoom-in-95">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-primary-foreground shadow-glow">
              <Camera className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">Câmera do dispositivo</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A leitura da partitura pela câmera do celular será ativada aqui. Por enquanto, use a
              entrada manual.
            </p>
            <button
              onClick={() => setPreview(false)}
              className="mt-5 w-full rounded-xl border border-border py-3 text-sm font-semibold transition active:scale-95"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      <PaywallModal
        open={paywall}
        onOpenChange={setPaywall}
        reason="A leitura da partitura por foto é exclusiva do plano PRO."
      />
    </main>
  );
}
