// Saldos automáticos via Pluggy (Meu Pluggy, Open Finance, gratuito para uso pessoal).
// Variáveis na Vercel: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS (ids das conexões, separados por vírgula).
const API = "https://api.pluggy.ai";

export type ContaAuto = {
  id: string;
  nome: string; // ex.: "Sicredi · Conta Corrente 12345-6"
  tipo: "brl" | "cartao";
  valor: number; // conta: saldo disponível; cartão: fatura em aberto
  atualizadoEm?: string;
  status?: string;
};

let cache: { key: string; expira: number } | null = null;

async function apiKey() {
  if (cache && cache.expira > Date.now()) return cache.key;
  const r = await fetch(`${API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: process.env.PLUGGY_CLIENT_ID, clientSecret: process.env.PLUGGY_CLIENT_SECRET }),
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.apiKey) throw new Error(`Pluggy auth ${r.status}: ${d.message || ""}`);
  cache = { key: d.apiKey, expira: Date.now() + 90 * 60_000 }; // a chave vale 2h; renovamos antes
  return d.apiKey as string;
}

async function get(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { "X-API-KEY": await apiKey() }, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Pluggy ${r.status}: ${d.message || path}`);
  return d;
}

export const pluggyConfigurado = () =>
  Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET && process.env.PLUGGY_ITEM_IDS);

/** Lista todas as contas e cartões das conexões configuradas. */
export async function contasAutomaticas(): Promise<ContaAuto[]> {
  if (!pluggyConfigurado()) return [];
  const ids = (process.env.PLUGGY_ITEM_IDS || "").split(/[\s,;]+/).filter(Boolean);
  const out: ContaAuto[] = [];
  for (const itemId of ids) {
    const item = await get(`/items/${itemId}`);
    const banco = item.connector?.name || "Banco";
    const contas = await get(`/accounts?itemId=${itemId}`);
    for (const a of contas.results || []) {
      if (a.currencyCode && a.currencyCode !== "BRL") continue;
      const cartao = a.type === "CREDIT";
      out.push({
        id: a.id,
        nome: `${banco} · ${a.name || (cartao ? "Cartão" : "Conta")}${a.number ? ` ${cartao ? "final " : ""}${a.number}` : ""}`,
        tipo: cartao ? "cartao" : "brl",
        valor: Math.round(Number(a.balance || 0) * 100) / 100,
        atualizadoEm: item.lastUpdatedAt || undefined,
        status: item.status,
      });
    }
  }
  return out;
}
