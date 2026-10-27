import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Criar nova senha — Octava" },
      {
        name: "description",
        content: "Defina uma nova senha para sua conta Octava.",
      },
      { property: "og:title", content: "Criar nova senha — Octava" },
      { property: "og:description", content: "Defina uma nova senha para sua conta Octava." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // O link de recuperação traz #type=recovery; a sessão de recuperação é criada ao abrir a página.
    if (window.location.hash.includes("type=recovery")) setReady(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada!");
      navigate({ to: "/conta" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-8 animate-in fade-in">
      <div className="glass rounded-3xl p-6 shadow-layer">
        <Lock className="h-7 w-7 text-primary" />
        <h1 className="mt-3 text-lg font-semibold">Criar nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "Escolha uma senha com pelo menos 6 caracteres."
            : "Abra o link que enviamos para o seu e-mail para continuar."}
        </p>

        {ready && (
          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Nova senha"
              className="w-full rounded-xl border border-input bg-secondary/50 px-3.5 py-3 text-sm outline-none transition focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        )}

        <Link to="/auth" className="mt-5 block text-center text-xs text-muted-foreground hover:underline">
          Voltar para o entrance
        </Link>
      </div>
    </main>
  );
}
