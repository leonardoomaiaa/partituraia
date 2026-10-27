import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startCheckout } from "@/lib/billing.functions";
import { useSubscription } from "@/lib/use-subscription";
import { useAuth } from "@/lib/auth-context";
import {
  ANNUAL_PRICE_ID,
  MONTHLY_PRICE_ID,
  PRO_PERKS,
  PRO_PRICES,
  annualSavingsPercent,
  monthlyEquivalentOfAnnual,
} from "@/lib/billing";

export function PaywallModal({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: string;
}) {
  const { signedIn, isPro } = useSubscription();
  const { user } = useAuth();
  const checkout = useServerFn(startCheckout);
  const [busy, setBusy] = useState<"month" | "year" | null>(null);

  if (!open) return null;

  const subscribe = async (interval: "month" | "year") => {
    if (!user) return;
    setBusy(interval);
    try {
      const { url } = await checkout({ data: { interval } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a assinatura.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Fechar"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      />
      <div className="relative w-full max-w-md animate-in slide-in-from-bottom-6 fade-in duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95">
        <div className="mx-3 mb-3 overflow-hidden rounded-t-3xl border border-border/70 bg-card shadow-layer sm:mb-0 sm:rounded-3xl">
          <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-primary/10 to-transparent p-5">
            <div>
              <h2 className="font-display text-xl font-bold leading-tight">Desbloqueie o Octava PRO</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {reason ?? "Tudo o que você precisa para estudar e tocar sem limites."}
              </p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="space-y-2.5 p-5">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15">
                  <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
                </span>
                <span className="text-foreground/90">{perk}</span>
              </li>
            ))}
          </ul>

          {!signedIn ? (
            <div className="px-5 pb-5">
              <Link
                to="/auth"
                onClick={() => onOpenChange(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98]"
              >
                Entrar para assinar
              </Link>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                É preciso entrar na conta antes de pagar.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 px-5 pb-5">
              <button
                disabled={busy !== null || isPro}
                onClick={() => subscribe("month")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-4 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy === "month" ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Assinar Agora ({PRO_PRICES.month.label})
              </button>

              <button
                disabled={busy !== null || isPro}
                onClick={() => subscribe("year")}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3.5 text-left transition active:scale-[0.98] disabled:opacity-60"
              >
                <span>
                  <span className="block text-sm font-semibold">Plano anual — {PRO_PRICES.year.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {monthlyEquivalentOfAnnual().toFixed(2).replace(".", ",")} por mês · economize{" "}
                    {annualSavingsPercent()}%
                  </span>
                </span>
                {busy === "year" ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" /> : null}
              </button>

              <p className="text-center text-[11px] text-muted-foreground">
                Pagamento seguro pelo Stripe. Cancele quando quiser.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ANNUAL_PRICE_ID, MONTHLY_PRICE_ID };
