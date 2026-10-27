import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANNUAL_PRICE_ID, MONTHLY_PRICE_ID, type BillingInterval, type PlanId } from "./billing";

const STRIPE_API = "https://api.stripe.com/v1";

type StripeCustomer = { id: string; email?: string | null };
type StripeSubscription = {
  id: string;
  status: string;
  current_period_end: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
};
type StripeList<T> = { data: T[] };

function stripeAuth(key: string): string {
  return `Basic ${btoa(`${key}:`)}`;
}

/** Codifica objetos aninhados no formato de formulário que a API do Stripe aceita. */
function encodeForm(params: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        parts.push(encodeForm(value[i] as Record<string, unknown>, `${name}[${i}]`));
      }
    } else if (typeof value === "object") {
      parts.push(encodeForm(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

async function stripeRequest<T>(
  key: string,
  path: string,
  init?: { query?: Record<string, string | number | undefined>; form?: Record<string, unknown> },
): Promise<T> {
  let url = `${STRIPE_API}${path}`;
  if (init?.query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) qs.set(k, String(v));
    }
    url = `${url}?${qs.toString()}`;
  }
  const response = await fetch(url, {
    method: init?.form ? "POST" : "GET",
    headers: {
      Authorization: stripeAuth(key),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: init?.form ? encodeForm(init.form) : null,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message ?? `A cobrança respondeu com erro ${response.status}.`;
    throw new Error(message);
  }
  return json as T;
}

function requireKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("A chave de cobrança ainda não foi configurada.");
  return key;
}

function appOrigin(): string {
  const request = getRequest();
  const header = request.headers.get("origin");
  if (header && /^https?:\/\//.test(header)) return header;
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://transpor-notas.lovable.app";
  }
}

async function findCustomer(key: string, email: string): Promise<StripeCustomer | null> {
  const found = await stripeRequest<StripeList<StripeCustomer>>(key, "/customers", {
    query: { email, limit: 1 },
  });
  return found.data[0] ?? null;
}

async function profileEmail(context: { supabase: { auth: { getUser: () => Promise<{ data: { user: { email?: string } | null } }> } } }): Promise<string> {
  const { data } = await context.supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new Error("Sua conta não tem e-mail cadastrado.");
  return email;
}

async function saveProfile(
  userId: string,
  email: string,
  plan: PlanId,
  subscriptionEnd: string | null,
  simulated: boolean,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("profiles").upsert({
    user_id: userId,
    email,
    plan,
    subscription_end: subscriptionEnd,
    simulated,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Não foi possível guardar o status do plano: ${error.message}`);
}

export type BillingStatus = {
  plan: PlanId;
  subscriptionEnd: string | null;
  email: string;
  testMode: boolean;
  simulated: boolean;
};

/** Consulta a assinatura no Stripe, grava o status no perfil e devolve o plano. */
export const getBillingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingStatus> => {
    const key = requireKey();
    const email = await profileEmail(context);

    let plan: PlanId = "free";
    let subscriptionEnd: string | null = null;
    let simulated = false;

    const customer = await findCustomer(key, email);
    if (customer) {
      const subs = await stripeRequest<StripeList<StripeSubscription>>(key, "/subscriptions", {
        query: { customer: customer.id, status: "active", limit: 5 },
      });
      const active = subs.data[0];
      if (active) {
        plan = "pro";
        subscriptionEnd = new Date(active.current_period_end * 1000).toISOString();
      }
    }

    if (plan !== "pro") {
      // Em modo de teste, uma liberação simulada continua valendo até a data simulada.
      const { data } = await context.supabase
        .from("profiles")
        .select("simulated, subscription_end")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (data?.simulated && data.subscription_end && new Date(data.subscription_end).getTime() > Date.now()) {
        plan = "pro";
        simulated = true;
        subscriptionEnd = data.subscription_end;
      }
    }

    await saveProfile(context.userId, email, plan, subscriptionEnd, simulated);
    return { plan, subscriptionEnd, email, testMode: key.startsWith("sk_test_"), simulated };
  });

/** Abre o Stripe Checkout para assinar o plano escolhido. */
export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: { interval: BillingInterval }) => {
    if (input.interval !== "month" && input.interval !== "year") {
      throw new Error("Plano inválido.");
    }
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const key = requireKey();
    const email = await profileEmail(context);
    const customer = await findCustomer(key, email);
    const origin = appOrigin();

    const session = await stripeRequest<{ url: string | null }>(key, "/checkout/sessions", {
      form: {
        customer: customer?.id,
        customer_email: customer?.id ? undefined : email,
        line_items: [{ price: data.interval === "year" ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID, quantity: 1 }],
        mode: "subscription",
        allow_promotion_codes: true,
        success_url: `${origin}/conta?checkout=sucesso`,
        cancel_url: `${origin}/conta?checkout=cancelado`,
      },
    });

    if (!session.url) throw new Error("O Stripe não devolveu o endereço do checkout.");
    return { url: session.url };
  });

/** Abre o portal do cliente Stripe (cancelar, trocar cartão, mudar plano). */
export const openCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = requireKey();
    const email = await profileEmail(context);
    const customer = await findCustomer(key, email);
    if (!customer) throw new Error("Nenhuma assinatura encontrada para esta conta.");

    const portal = await stripeRequest<{ url: string | null }>(key, "/billing_portal/sessions", {
      form: { customer: customer.id, return_url: `${appOrigin()}/conta` },
    });
    if (!portal.url) throw new Error("O Stripe não devolveu o endereço do portal.");
    return { url: portal.url };
  });

/** Libera o PRO na hora, mas só enquanto a cobrança estiver em modo de teste. */
export const activateProForTesting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = requireKey();
    if (!key.startsWith("sk_test_")) {
      throw new Error("A liberação instantânea só existe no modo de teste.");
    }
    const email = await profileEmail(context);
    const subscriptionEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await saveProfile(context.userId, email, "pro", subscriptionEnd, true);
    return { ok: true, subscriptionEnd };
  });
