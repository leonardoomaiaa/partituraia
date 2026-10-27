import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CreditCard,
  ExternalLink,
  FolderOpen,
  Loader2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { openCustomerPortal, activateProForTesting } from "@/lib/billing.functions";
import { useSubscription } from "@/lib/use-subscription";
import { useAuth } from "@/lib/auth-context";
import { PRO_PRICES, brl } from "@/lib/billing";
import { getHistory, getFolders } from "@/lib/store";

type ContaSearch = { checkout?: "sucesso" | "cancelado" | undefined };

export const Route = createFileRoute("/conta")({
  validateSearch: (search: Record<string, unknown>): ContaSearch => {
    const out: ContaSearch = {};
    const value = search["checkout"];
    if (value === "sucesso" || value === "cancelado") out.checkout = value;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Minha conta — Octava" },
      {
        name: "description",
        content: "Veja seu plano, gerencie a assinatura PRO e acompanhe suas músicas salvas.",
      },
      { property: "og:title", content: "Minha conta — Octava" },
      { property: "og:description", content: "Plano, assinatura e músicas salvas na sua conta Octava." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContaPage,
});

function ContaPage() {
  const { checkout } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sub = useSubscription();
  const portal = useServerFn(openCustomerPortal);
  const simulate = useServerFn(activateProForTesting);
  const [busy, setBusy] = useState<"portal" | "simulate" | null>(null);
  const checkedOut = useRef(false);

  const songs = getHistory();
  const folders = getFolders();

  // Depois de voltar do Stripe, o status pode demorar alguns segundos para aparecer.
  useEffect(() => {
    if (checkout !== "sucesso" || checkedOut.current) return;
    checkedOut.current = true;
    toast.success("Pagamento confirmado! Liberando o PRO...");
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      sub.refresh();
      if (attempts >= 6) window.clearInterval(timer);
    }, 2500);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  useEffect(() => {
    if (checkout === "cancelado") toast("Assinatura cancelada antes do pagamento.");
  }, [checkout]);

  const manage = async () => {
    setBusy("portal");
    try {
      const { url } = await portal();
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "O portal do cliente ainda não está ativo na sua conta Stripe.",
      );
    } finally {
      setBusy(null);
    }
  };

  const simulatePro = async () => {
    setBusy("simulate");
    try {
      await simulate();
      toast.success("PRO liberado em modo de teste!");
      sub.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível liberar o PRO.");
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!user) {
    return (
      <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="glass mt-6 rounded-3xl p-6 text-center shadow-layer">
          <h1 className="text-lg font-semibold">Você ainda não entrou</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre ou crie uma conta para ver seu plano e assinar o PRO.
          </p>
          <Link
            to="/auth"
            className="mt-5 block rounded-2xl bg-gold py-3.5 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98]"
          >
            Entrar ou criar conta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-4 animate-in fade-in">
      <div className="flex items-center gap-2">
        <Link to="/" className="rounded-xl p-2 transition hover:bg-muted active:scale-95" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Minha conta</h1>
      </div>

      <section
        className={`mt-4 overflow-hidden rounded-3xl border p-5 shadow-layer transition ${
          sub.isPro ? "border-primary/50 bg-gradient-to-b from-primary/12 to-transparent" : "border-border/70 bg-card"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Status atual
            </p>
            <p className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
              {sub.isPro ? (
                <>
                  Assinante PRO Ativo <Sparkles className="h-5 w-5 text-primary" />
                </>
              ) : (
                "Plano Free"
              )}
            </p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{sub.email ?? user.email}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              sub.isPro ? "bg-gold text-primary-foreground shadow-glow" : "border border-border text-muted-foreground"
            }`}
          >
            {sub.isPro ? "PRO" : "FREE"}
          </span>
        </div>

        {sub.isPro && sub.subscriptionEnd && (
          <p className="mt-3 text-xs text-muted-foreground">
            {sub.simulated ? "Liberação de teste válida até " : "Renova em "}
            {new Date(sub.subscriptionEnd).toLocaleDateString("pt-BR")}
          </p>
        )}

        {!sub.isPro && (
          <>
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                <span className="font-semibold">{songs.length}</span> de{" "}
                <span className="font-semibold">{sub.freeLimit}</span> músicas salvas no plano gratuito
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${Math.min(100, (songs.length / sub.freeLimit) * 100)}%` }}
                />
              </div>
            </div>
            <Link
              to="/"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98]"
            >
              Assinar o PRO ({PRO_PRICES.month.label})
            </Link>
          </>
        )}
      </section>

      <section className="mt-4 space-y-2.5">
        {sub.isPro && (
          <button
            onClick={manage}
            disabled={busy !== null}
            className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Gerenciar Assinatura
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        {sub.testMode && !sub.isPro && (
          <button
            onClick={simulatePro}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/50 py-3.5 text-sm font-semibold text-primary transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "simulate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Liberar PRO agora (simulação de teste)
          </button>
        )}

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3.5 text-sm font-semibold text-muted-foreground transition active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </section>

      <section className="mt-4 rounded-3xl border border-border/70 bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className="h-4 w-4 text-primary" /> Suas pastas
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {folders.length} pasta{folders.length === 1 ? "" : "s"} · {songs.length} música
          {songs.length === 1 ? "" : "s"} salva{songs.length === 1 ? "" : "s"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {folders.map((f) => (
            <span key={f} className="rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs">
              {f}
            </span>
          ))}
        </div>
        {!sub.isPro && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            No plano gratuito você guarda até {sub.freeLimit} músicas. O PRO libera o histórico ilimitado e a
            exportação em PDF (R$ {brl(PRO_PRICES.month.amount)}/mês).
          </p>
        )}
      </section>
    </main>
  );
}
