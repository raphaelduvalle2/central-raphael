// Instagram via "API setup with Unified login" (apps novos da Meta, desde out/2026):
// token de usuário do sistema que não expira, colado na Vercel como INSTAGRAM_TOKEN. Host: graph.facebook.com.
import type { Item } from "./briefing";
import { relevancia } from "./youtube";

const G = "https://graph.facebook.com";

export type IgConta = { token: string; userId: string; username: string };

async function ig(path: string, token: string, init?: RequestInit) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${G}${path}${sep}access_token=${encodeURIComponent(token)}`, { ...init, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${String(data?.error?.message || JSON.stringify(data)).slice(0, 200)}`);
  return data;
}

let cache: IgConta | null = null;

/** Descobre a conta do Instagram ligada ao token. */
export async function contaInstagram(): Promise<IgConta | null> {
  const token = process.env.INSTAGRAM_TOKEN;
  if (!token) return null;
  if (cache?.token === token) return cache;
  let userId = process.env.INSTAGRAM_USER_ID || "";
  let username = "";
  if (!userId) {
    try {
      const r = await ig("/me/assigned_instagram_accounts?fields=id,username", token);
      userId = r.data?.[0]?.id || "";
      username = r.data?.[0]?.username || "";
    } catch { /* tenta o caminho antigo abaixo */ }
  }
  if (!userId) {
    const r = await ig("/me/accounts?fields=instagram_business_account{id,username}", token);
    const acc = (r.data || []).find((p: any) => p.instagram_business_account)?.instagram_business_account;
    userId = acc?.id || "";
    username = acc?.username || "";
  }
  if (!userId) throw new Error("Não encontrei a conta do Instagram ligada ao token.");
  if (!username) username = (await ig(`/${userId}?fields=username`, token)).username || "";
  cache = { token, userId, username };
  return cache;
}

/** Comentários e DMs relevantes dos últimos dias, sem resposta sua. */
export async function pendenciasInstagram(c: IgConta, feitos: Set<string>, dias = 7) {
  const desde = Date.now() - dias * 86_400_000;
  const items: Item[] = [];
  let lidos = 0;
  const meu = (u?: string) => (u || "").toLowerCase() === c.username.toLowerCase();

  const media = await ig(`/${c.userId}/media?fields=id,caption,permalink,timestamp&limit=15`, c.token);
  for (const m of media.data || []) {
    const r = await ig(`/${m.id}/comments?fields=id,text,username,timestamp,replies{username}&limit=50`, c.token);
    for (const cm of r.data || []) {
      if (new Date(cm.timestamp).getTime() < desde) continue;
      lidos++;
      const respondido = (cm.replies?.data || []).some((x: any) => meu(x.username));
      if (meu(cm.username) || respondido || feitos.has(cm.id) || relevancia(cm.text || "") < 2) continue;
      items.push({
        id: cm.id, source: "instagram", kind: "instagram", urgent: false, reply: true,
        replyEndpoint: "/api/instagram", replyMeta: { tipo: "comentario" },
        who: `@${cm.username}`, title: (m.caption || "Publicação").split("\n")[0].slice(0, 90),
        preview: cm.text, date: cm.timestamp, gmailUrl: "",
        actionUrl: m.permalink, actionLabel: "Abrir no Instagram",
      });
    }
  }

  // DMs (opcional: se a Meta não liberar para este token, seguimos só com comentários).
  try {
    const conv = await ig(`/${c.userId}/conversations?platform=instagram&fields=updated_time,messages.limit(3){message,from,created_time}&limit=25`, c.token);
    for (const cv of conv.data || []) {
      if (new Date(cv.updated_time).getTime() < desde) continue;
      const ultima = cv.messages?.data?.[0];
      if (!ultima?.message) continue;
      lidos++;
      if (meu(ultima.from?.username) || ultima.from?.id === c.userId) continue;
      const id = `dm:${cv.id}:${ultima.created_time}`;
      if (feitos.has(id) || relevancia(ultima.message) < 1) continue;
      items.push({
        id, source: "instagram", kind: "dm", urgent: false, reply: true,
        replyEndpoint: "/api/instagram", replyMeta: { tipo: "dm", para: ultima.from?.id },
        who: `@${ultima.from?.username || "alguém"}`, title: "Mensagem direta", preview: ultima.message,
        date: ultima.created_time, gmailUrl: "", actionUrl: "https://www.instagram.com/direct/inbox/", actionLabel: "Abrir no Instagram",
      });
    }
  } catch (e: any) {
    console.error("instagram dms", e?.message);
  }
  return { items, lidos };
}

export async function responderInstagram(c: IgConta, id: string, texto: string, meta: { tipo: string; para?: string }) {
  if (meta.tipo === "dm") {
    if (!meta.para) throw new Error("destinatário ausente");
    await ig(`/${c.userId}/messages`, c.token, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: meta.para }, message: { text: texto } }),
    });
  } else {
    await ig(`/${id}/replies`, c.token, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ message: texto }),
    });
  }
}
