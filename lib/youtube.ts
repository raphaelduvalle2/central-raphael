// Comentários do canal no YouTube: só o que é sobre baixo/curso e ainda não foi respondido.
import type { Item } from "./briefing";

const API = "https://www.googleapis.com/youtube/v3";

export class YouTubeScopeError extends Error {}

async function yt(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (res.ok) return res.json();
  const t = await res.text();
  if (res.status === 401 || (res.status === 403 && /insufficient|scope|accessNotConfigured|has not been used|disabled/i.test(t)))
    throw new YouTubeScopeError(t.slice(0, 200));
  throw new Error(`YouTube ${res.status}: ${t.slice(0, 200)}`);
}

// --- Relevância -------------------------------------------------------------
const TEMAS = /\b(baix(o|ista|os)|contrabaixo|curso|aula|vip|c3|escala|arpejo|groove|slap|palheta|dedilhad|tablatura|tab|partitura|harmonia|pentat[oô]nica|braço|nota|acorde|t[ée]cnica|exerc[ií]cio|ritmo|metr[ôo]nomo|corda|cordas|afina|captador|amplificador|pedal|iniciante|estudar|estudo|aprender|link|pre[çc]o|valor|comprar|inscri|matr[ií]cula|desconto|ebook|apostila|teoria|campo harm|walking|jazz|funk|samba|gospel|levada)/i;
const ELOGIO_CURTO = /^(top|show|massa|demais|incr[ií]vel|sensacional|parab[ée]ns|muito bom|que som|lindo|brabo|monstro|fera|caramba|nossa|top demais|show de bola)[\s!.,👏🔥❤️🙌😍👍🎸]*$/i;

export function relevancia(texto: string): number {
  const t = texto.trim();
  if (t.length < 4 || ELOGIO_CURTO.test(t)) return 0;
  if (/^[\p{Emoji}\s\p{P}]+$/u.test(t)) return 0; // só emojis
  if (t.split(/\s+/).length <= 2 && !t.includes("?")) return 0; // palavra-chave solta (ex.: "GROOVE")
  let s = 0;
  if (t.includes("?")) s += 2;
  if (/^(como|qual|quais|onde|quando|por ?que|vc|voc[êe]|professor|raphael|rapha|mestre)\b/i.test(t)) s += 1;
  if (TEMAS.test(t)) s += 2;
  if (t.length > 80) s += 1;
  return s;
}

// --- Busca ------------------------------------------------------------------
type Comment = {
  id: string; videoId: string; author: string; text: string; publishedAt: string; ownerReplied: boolean; mine: boolean;
};

export async function comentariosRecentes(token: string, feitos: Set<string>, dias = 7): Promise<{ items: Item[]; lidos: number; canal: string }> {
  const canal = await yt(token, "/channels?part=id,snippet&mine=true");
  const channelId: string | undefined = canal.items?.[0]?.id;
  const nomeCanal: string = canal.items?.[0]?.snippet?.title || "";
  if (!channelId) return { items: [], lidos: 0, canal: "" };

  const desde = Date.now() - dias * 86_400_000;
  const comments: Comment[] = [];
  let pageToken = "";
  for (let page = 0; page < 3; page++) {
    const q = new URLSearchParams({
      part: "snippet,replies", allThreadsRelatedToChannelId: channelId, order: "time", maxResults: "100", textFormat: "plainText",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const r = await yt(token, `/commentThreads?${q}`);
    let antigo = false;
    for (const th of r.items || []) {
      const top = th.snippet.topLevelComment.snippet;
      if (new Date(top.publishedAt).getTime() < desde) { antigo = true; continue; }
      comments.push({
        id: th.id,
        videoId: th.snippet.videoId,
        author: top.authorDisplayName,
        text: top.textOriginal || top.textDisplay || "",
        publishedAt: top.publishedAt,
        mine: top.authorChannelId?.value === channelId,
        ownerReplied: (th.replies?.comments || []).some((c: any) => c.snippet.authorChannelId?.value === channelId),
      });
    }
    if (antigo || !r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }

  const relevantes = comments.filter((c) => !c.mine && !c.ownerReplied && !feitos.has(c.id) && relevancia(c.text) >= 2);
  if (relevantes.length === 0) return { items: [], lidos: comments.length, canal: nomeCanal };

  // Títulos dos vídeos (1 chamada para até 50 vídeos).
  const ids = [...new Set(relevantes.map((c) => c.videoId))].slice(0, 50);
  const v = await yt(token, `/videos?part=snippet&id=${ids.join(",")}`);
  const titulo = new Map<string, string>((v.items || []).map((x: any) => [x.id, x.snippet.title]));

  const items = relevantes.map((c) => ({
    id: c.id,
    source: "youtube" as const,
    kind: "youtube" as const,
    urgent: false,
    who: c.author,
    title: titulo.get(c.videoId) || "Comentário no YouTube",
    preview: c.text.slice(0, 400),
    date: c.publishedAt,
    gmailUrl: "",
    actionUrl: `https://www.youtube.com/watch?v=${c.videoId}&lc=${c.id}`,
    actionLabel: "Abrir no YouTube",
    reply: true,
  }));
  return { items, lidos: comments.length, canal: nomeCanal };
}

/** Responde como o canal. */
export async function responder(token: string, threadId: string, texto: string) {
  await yt(token, "/comments?part=snippet", {
    method: "POST",
    body: JSON.stringify({ snippet: { parentId: threadId, textOriginal: texto } }),
  });
}
