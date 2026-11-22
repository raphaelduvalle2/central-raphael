// Instagram (API com Instagram Login, conta profissional, acesso padrão: não precisa de App Review para a própria conta).
// O token de longa duração (60 dias) fica guardado na pasta privada do app no Drive e é renovado sozinho.
import type { Item } from "./briefing";
import { lerJson, salvarJson } from "./drive";
import { relevancia } from "./youtube";

const G = "https://graph.instagram.com";
const FILE = "instagram.json";
export const IG_SCOPES = "instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages";

export type IgConta = { token: string; userId: string; username: string; expiresAt: string } | null;

export const redirectUri = () => `${process.env.NEXTAUTH_URL}/api/instagram/callback`;

export function urlDeAutorizacao(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: IG_SCOPES,
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

async function ig(path: string, init?: RequestInit) {
  const res = await fetch(path.startsWith("http") ? path : `${G}${path}`, { ...init, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${JSON.stringify(data?.error?.message || data).slice(0, 200)}`);
  return data;
}

/** Troca o code do login por um token de 60 dias e guarda no Drive. */
export async function conectar(googleToken: string, code: string) {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID || "",
    client_secret: process.env.INSTAGRAM_APP_SECRET || "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const curto = await ig("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const longo = await ig(
    `/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.INSTAGRAM_APP_SECRET || "")}&access_token=${encodeURIComponent(curto.access_token)}`,
  );
  const me = await ig(`/me?fields=user_id,username&access_token=${encodeURIComponent(longo.access_token)}`);
  const conta = {
    token: longo.access_token,
    userId: String(me.user_id || me.id),
    username: me.username,
    expiresAt: new Date(Date.now() + (longo.expires_in || 5_184_000) * 1000).toISOString(),
  };
  await salvarJson(googleToken, FILE, conta);
  return conta;
}

/** Lê a conta conectada; renova o token quando faltam menos de 10 dias. */
export async function contaInstagram(googleToken: string): Promise<IgConta> {
  const conta = await lerJson<IgConta>(googleToken, FILE, null);
  if (!conta?.token) return null;
  const falta = new Date(conta.expiresAt).getTime() - Date.now();
  if (falta < 10 * 86_400_000 && falta > 0) {
    try {
      const r = await ig(`/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(conta.token)}`);
      const nova = { ...conta, token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() };
      await salvarJson(googleToken, FILE, nova);
      return nova;
    } catch { /* segue com o token atual */ }
  }
  return falta > 0 ? conta : null;
}

const tk = (c: NonNullable<IgConta>) => `access_token=${encodeURIComponent(c.token)}`;

/** Comentários e DMs relevantes dos últimos dias, sem resposta sua. */
export async function pendenciasInstagram(c: NonNullable<IgConta>, feitos: Set<string>, dias = 7) {
  const desde = Date.now() - dias * 86_400_000;
  const items: Item[] = [];
  let lidos = 0;
  const meu = (u?: string) => (u || "").toLowerCase() === c.username.toLowerCase();

  // Comentários nas publicações recentes.
  const media = await ig(`/me/media?fields=id,caption,permalink,timestamp&limit=15&${tk(c)}`);
  for (const m of media.data || []) {
    const r = await ig(`/${m.id}/comments?fields=id,text,username,timestamp,replies{username}&limit=50&${tk(c)}`);
    for (const cm of r.data || []) {
      if (new Date(cm.timestamp).getTime() < desde) continue;
      lidos++;
      const respondido = (cm.replies?.data || []).some((x: any) => meu(x.username));
      if (meu(cm.username) || respondido || feitos.has(cm.id) || relevancia(cm.text || "") < 2) continue;
      items.push({
        id: cm.id, source: "instagram", kind: "instagram", urgent: false, reply: true,
        replyEndpoint: "/api/instagram", replyMeta: { tipo: "comentario" },
        who: `@${cm.username}`,
        title: (m.caption || "Publicação").split("\n")[0].slice(0, 90),
        preview: cm.text, date: cm.timestamp, gmailUrl: "",
        actionUrl: m.permalink, actionLabel: "Abrir no Instagram",
      });
    }
  }

  // DMs: conversas em que a última mensagem é da outra pessoa.
  try {
    const conv = await ig(`/me/conversations?platform=instagram&fields=updated_time,participants,messages.limit(3){message,from,created_time}&limit=25&${tk(c)}`);
    for (const cv of conv.data || []) {
      if (new Date(cv.updated_time).getTime() < desde) continue;
      const ultima = cv.messages?.data?.[0];
      if (!ultima?.message) continue;
      lidos++;
      const deQuem = ultima.from?.username || ultima.from?.id;
      if (meu(ultima.from?.username) || ultima.from?.id === c.userId) continue;
      const id = `dm:${cv.id}:${ultima.created_time}`;
      if (feitos.has(id) || relevancia(ultima.message) < 1) continue;
      items.push({
        id, source: "instagram", kind: "dm", urgent: false, reply: true,
        replyEndpoint: "/api/instagram", replyMeta: { tipo: "dm", para: ultima.from?.id },
        who: `@${deQuem}`, title: "Mensagem direta", preview: ultima.message, date: ultima.created_time,
        gmailUrl: "", actionUrl: "https://www.instagram.com/direct/inbox/", actionLabel: "Abrir no Instagram",
      });
    }
  } catch (e: any) {
    console.error("instagram dms", e?.message);
  }

  return { items, lidos };
}

export async function responderInstagram(c: NonNullable<IgConta>, id: string, texto: string, meta: { tipo: string; para?: string }) {
  if (meta.tipo === "dm") {
    if (!meta.para) throw new Error("destinatário ausente");
    await ig(`/me/messages?${tk(c)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: meta.para }, message: { text: texto } }),
    });
  } else {
    await ig(`/${id}/replies?${tk(c)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message: texto }),
    });
  }
}
