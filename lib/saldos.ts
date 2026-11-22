// Saldos: o equivalente à aba PESSOAL da planilha.
// Líquido real = contas em R$ + contas em US$ × dólar − faturas dos cartões.
// A conta marcada com "recebeVendas" (Pagar.me) é projetada: último valor + líquido estimado das vendas desde então.

export type Tipo = "brl" | "usd" | "cartao";
export type Conta = { id: string; nome: string; tipo: Tipo; valor: number; recebeVendas?: boolean };
export type Saldos = { contas: Conta[]; dolar: number; atualizadoEm: string | null };

// Valores iniciais copiados da planilha "TMBX - CONTROLE TOTAL - 2026" (aba PESSOAL).
export const PADRAO: Saldos = {
  dolar: 5.58,
  atualizadoEm: null,
  contas: [
    { id: "pagarme", nome: "Pagar.me", tipo: "brl", valor: 7600, recebeVendas: true },
    { id: "mercadopago", nome: "Mercado Pago", tipo: "brl", valor: 2000 },
    { id: "sicredi-pf", nome: "Sicredi PF", tipo: "brl", valor: 861 },
    { id: "sicredi-pj", nome: "Sicredi PJ", tipo: "brl", valor: 40 },
    { id: "kiwify", nome: "Kiwify", tipo: "brl", valor: 0 },
    { id: "hotmart", nome: "Hotmart", tipo: "brl", valor: 0 },
    { id: "paypal-pes", nome: "PayPal Pessoal", tipo: "brl", valor: 0 },
    { id: "paypal-emp", nome: "PayPal Empresa", tipo: "brl", valor: 0 },
    { id: "adsense", nome: "Google AdSense", tipo: "usd", valor: 327 },
    { id: "paypal-usd", nome: "PayPal (US$)", tipo: "usd", valor: 0 },
    { id: "hotmart-usd", nome: "Hotmart (US$)", tipo: "usd", valor: 0 },
    { id: "hotmart-intl", nome: "Hotmart International", tipo: "usd", valor: 0 },
    { id: "nubank", nome: "Cartão Nubank", tipo: "cartao", valor: 1605 },
    { id: "black", nome: "Cartão Black", tipo: "cartao", valor: 1261 },
  ],
};

export type Resumo = {
  liquido: number;
  emContas: number;
  emDolar: number;
  cartoes: number;
  vendasDesde: { count: number; net: number };
  projetada?: { nome: string; base: number; atual: number };
  diasDesde: number | null;
};

export function resumir(s: Saldos, vendas: { date: string; net: number }[], agora = new Date()): Resumo {
  const desde = s.atualizadoEm ? new Date(s.atualizadoEm) : null;
  const novas = desde ? vendas.filter((v) => new Date(v.date) > desde) : [];
  const vendasNet = novas.reduce((t, v) => t + v.net, 0);

  let emContas = 0, emDolar = 0, cartoes = 0;
  let projetada: Resumo["projetada"];
  for (const c of s.contas) {
    if (c.tipo === "brl") {
      const extra = c.recebeVendas ? vendasNet : 0;
      if (c.recebeVendas) projetada = { nome: c.nome, base: c.valor, atual: c.valor + extra };
      emContas += c.valor + extra;
    } else if (c.tipo === "usd") emDolar += c.valor * s.dolar;
    else cartoes += c.valor;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    liquido: r2(emContas + emDolar - cartoes),
    emContas: r2(emContas),
    emDolar: r2(emDolar),
    cartoes: r2(cartoes),
    vendasDesde: { count: novas.length, net: r2(vendasNet) },
    projetada,
    diasDesde: desde ? Math.floor((agora.getTime() - desde.getTime()) / 86_400_000) : null,
  };
}

/** Valida o que vem do formulário. */
export function sanitizar(input: any): Saldos {
  const num = (x: any) => {
    const n = typeof x === "string" ? Number(x.replace(/\./g, "").replace(",", ".")) : Number(x);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };
  const contas: Conta[] = (Array.isArray(input?.contas) ? input.contas : []).slice(0, 40).map((c: any, i: number) => ({
    id: String(c?.id || `conta-${i}`).slice(0, 40),
    nome: String(c?.nome || "Conta").slice(0, 60),
    tipo: (["brl", "usd", "cartao"].includes(c?.tipo) ? c.tipo : "brl") as Tipo,
    valor: num(c?.valor),
    recebeVendas: Boolean(c?.recebeVendas),
  }));
  return { contas, dolar: num(input?.dolar) || 5, atualizadoEm: new Date().toISOString() };
}

const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
/** Já atualizou hoje (no fuso de São Paulo)? */
export function atualizadoHoje(s: Saldos, agora = new Date()) {
  return Boolean(s.atualizadoEm) && dia(new Date(s.atualizadoEm!)) === dia(agora);
}
