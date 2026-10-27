import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

type AuthSearch = { redirect?: string | undefined; motivo?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const out: AuthSearch = {};
    if (typeof search["redirect"] === "string") out.redirect = search["redirect"];
    if (typeof search["motivo"] === "string") out.motivo = search["motivo"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Octava" },
      {
        name: "description",
        content: "Entre com e-mail e senha ou com sua conta Google para assinar o Octava PRO.",
      },
      { property: "og:title", content: "Entrar ou criar conta — Octava" },
      {
        property: "og:description",
        content: "Acesse sua conta Octava para salvar transposições e assinar o PRO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "entrar" | "cadastro" | "recuperar";

function AuthPage() {
  const { redirect, motivo } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"confirma" | "recupera" | null>(null);

  const goAfterLogin = () => {
    const target = redirect && redirect.startsWith("/") ? redirect : "/conta";
    navigate({ to: target });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        goAfterLogin();
      } else if (mode === "cadastro") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Conta criada!");
          goAfterLogin();
        } else {
          setSent("confirma");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("recupera");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  const withGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "O Google não concluiu o acesso.");
      return;
    }
    if (result.redirected) return;
    goAfterLogin();
  };

  if (sent) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <div className="glass rounded-3xl p-6 text-center shadow-layer">
          <Mail className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-3 text-lg font-semibold">
            {sent === "confirma" ? "Confirme seu e-mail" : "Confira sua caixa de entrada"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {sent === "confirma"
              ? `Enviamos um link de confirmação para ${email}. Depois de confirmar, entre na conta.`
              : `Se existir uma conta com ${email}, você receberá um link para criar uma nova senha.`}
          </p>
          <button
            onClick={() => setSent(null)}
            className="mt-5 w-full rounded-2xl border border-border py-3 text-sm font-semibold transition active:scale-95"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-10 pt-5 animate-in fade-in">
      <div className="flex items-center gap-2">
        <Link to="/" className="rounded-xl p-2 transition hover:bg-muted active:scale-95" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">
          {mode === "entrar" ? "Entrar na conta" : mode === "cadastro" ? "Criar conta" : "Recuperar senha"}
        </h1>
      </div>

      {motivo && <p className="mt-2 text-sm text-primary">{motivo}</p>}

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="voce@email.com"
            className="mt-1 w-full rounded-xl border border-input bg-secondary/50 px-3.5 py-3 text-sm outline-none transition focus:border-primary/60"
          />
        </label>

        {mode !== "recuperar" && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "entrar" ? "current-password" : "new-password"}
              placeholder="mínimo de 6 caracteres"
              className="mt-1 w-full rounded-xl border border-input bg-secondary/50 px-3.5 py-3 text-sm outline-none transition focus:border-primary/60"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3.5 font-semibold text-primary-foreground shadow-glow transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "entrar" ? "Entrar" : mode === "cadastro" ? "Criar conta" : "Enviar link"}
        </button>
      </form>

      {mode === "entrar" && (
        <button
          onClick={() => setMode("recuperar")}
          className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </button>
      )}

      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={withGoogle}
        className="glass flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.24 1.4-1.66 4.1-5.5 4.1-3.3 0-6-2.75-6-6.15S8.7 5.9 12 5.9c1.9 0 3.16.8 3.88 1.5l2.65-2.55C16.85 3.3 14.7 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.35 0 8.9-3.76 8.9-9.05 0-.6-.06-1.06-.14-1.55H12z"
          />
        </svg>
        Continuar com Google
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "entrar" ? (
          <>
            Ainda não tem conta?{" "}
            <button onClick={() => setMode("cadastro")} className="font-semibold text-primary underline-offset-4 hover:underline">
              Criar conta
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button onClick={() => setMode("entrar")} className="font-semibold text-primary underline-offset-4 hover:underline">
              Entrar
            </button>
          </>
        )}
      </p>
    </main>
  );
}
