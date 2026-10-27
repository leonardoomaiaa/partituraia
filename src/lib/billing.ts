// Regras de plano do Octava. Este arquivo é seguro para o navegador:
// só contém constantes e funções puras, sem chaves nem chamadas de rede.

export const PRO_PRODUCT_ID = "prod_VW2bMKzqdQT4gD";
export const MONTHLY_PRICE_ID = "price_1UV0WBKr69z9DMejNrdfUDyh";
export const ANNUAL_PRICE_ID = "price_1UV0agKr69z9DMejxQ2OczHq";

export type PlanId = "free" | "pro";
export type BillingInterval = "month" | "year";

export const PRO_PRICES = {
  month: { priceId: MONTHLY_PRICE_ID, amount: 9.9, label: "R$ 9,90/mês" },
  year: { priceId: ANNUAL_PRICE_ID, amount: 89.9, label: "R$ 89,90/ano" },
} as const;

/** Quantas músicas salvas um plano gratuito pode manter. */
export const FREE_SONG_LIMIT = 10;

export const PRO_PERKS = [
  "Leitura da partitura por foto (scanner OMR)",
  "Exportação da transposição em PDF",
  "Histórico ilimitado em pastas",
  "App sem anúncios",
] as const;

/** O plano gratuito pode salvar mais uma música? */
export function canSaveSong(plan: PlanId, savedCount: number): boolean {
  if (plan === "pro") return true;
  return savedCount < FREE_SONG_LIMIT;
}

/** Preço mensal equivalente do plano anual, em reais. */
export function monthlyEquivalentOfAnnual(): number {
  return Math.round((PRO_PRICES.year.amount / 12) * 100) / 100;
}

/** Percentual de economia do plano anual frente a 12 mensalidades. */
export function annualSavingsPercent(): number {
  const yearly = PRO_PRICES.month.amount * 12;
  return Math.round(((yearly - PRO_PRICES.year.amount) / yearly) * 100);
}

/** Valor em reais no formato brasileiro. */
export function brl(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
