// Acesso mínimo à Gmail API (sem bibliotecas extras).
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export type Mail = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: Date;
  snippet: string;
  body: string;
  labels: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chamada à Gmail API com novas tentativas em limite de taxa (429) e falhas temporárias (5xx). */
async function g(token: string, path: string, init?: RequestInit) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (res.ok) return res.status === 204 ? {} : res.json();
    const retryable = res.status === 429 || res.status >= 500 ||
      (res.status === 403 && /rateLimit|userRateLimit/i.test(await res.clone().text()));
    if (retryable && attempt < 4) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
      continue;
    }
    throw new Error(`Gmail ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

function decode(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", zwnj: "", ndash: "–", mdash: "—",
};
export function decodeEntities(t: string) {
  return t
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function extractBody(payload: any): string {
  // Prefere text/plain; se não houver, usa HTML sem tags.
  const parts: any[] = [];
  const walk = (p: any) => {
    if (!p) return;
    parts.push(p);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  const plain = parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
  if (plain) return decode(plain.body.data);
  const html = parts.find((p) => p.mimeType === "text/html" && p.body?.data);
  if (html) {
    return decode(html.body.data)
      .replace(/<a [^>]*href="([^"]+)"[^>]*>/gi, " ($1) ")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&[a-z#0-9]+;/gi, (e) => decodeEntities(e));
  }
  return "";
}

/** Lista e busca mensagens completas, em lotes paralelos. */
// Cache de mensagens já baixadas (conteúdo de email não muda; rótulos são ajustados quando a Central mexe).
// Vive enquanto o servidor da Vercel estiver "quente" e evita baixar de novo centenas de avisos de venda.
const CACHE = new Map<string, Mail>();
const CACHE_MAX = 4000;
function guardar(key: string, m: Mail) {
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value as string);
  CACHE.set(key, m);
}
function tirarRotulos(ids: string[], rotulos: string[]) {
  for (const [k, m] of CACHE) if (ids.includes(m.id)) CACHE.set(k, { ...m, labels: m.labels.filter((l) => !rotulos.includes(l)) });
}

export async function searchMail(token: string, q: string, max = 200, full = true): Promise<Mail[]> {
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < max) {
    const params = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await g(token, `/messages?${params}`);
    (r.messages || []).forEach((m: any) => ids.push(m.id));
    if (!r.nextPageToken) break;
    pageToken = r.nextPageToken;
  }
  const fmt = full ? "format=full" : "format=metadata&metadataHeaders=From&metadataHeaders=Subject";
  const chave = (id: string) => `${full ? "f" : "m"}:${id}`;
  const lista = ids.slice(0, max);
  const faltam = lista.filter((id) => !CACHE.has(chave(id)));
  const batch = 8;
  for (let i = 0; i < faltam.length; i += batch) {
    const chunk = faltam.slice(i, i + batch);
    const msgs = await Promise.all(chunk.map((id) => g(token, `/messages/${id}?${fmt}`)));
    for (const m of msgs) {
      const h = (name: string) =>
        m.payload?.headers?.find((x: any) => x.name.toLowerCase() === name)?.value || "";
      guardar(chave(m.id), {
        id: m.id,
        threadId: m.threadId,
        from: (h("from").match(/<([^>]+)>/)?.[1] || h("from")).toLowerCase(),
        subject: h("subject"),
        date: new Date(Number(m.internalDate)),
        snippet: decodeEntities(m.snippet || ""),
        body: extractBody(m.payload),
        labels: m.labelIds || [],
      });
    }
  }
  const out = lista.map((id) => CACHE.get(chave(id))).filter(Boolean) as Mail[];
  return out;
}

/** Garante que o marcador existe e devolve seu id (tolera criação simultânea). */
export async function ensureLabel(token: string, name: string): Promise<string> {
  const find = async () => {
    const r = await g(token, "/labels");
    return (r.labels || []).find((l: any) => String(l.name).toLowerCase() === name.toLowerCase());
  };
  const found = await find();
  if (found) return found.id;
  // Cria o pai antes ("Central"), depois o filho ("Central/Feito").
  const parts = name.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const n = parts.slice(0, i).join("/");
    try {
      await g(token, "/labels", {
        method: "POST",
        body: JSON.stringify({ name: n, labelListVisibility: "labelShow", messageListVisibility: "show" }),
      });
    } catch (e: any) {
      if (!String(e?.message).includes("409")) throw e; // 409 = já existe
    }
  }
  const again = await find();
  if (!again) throw new Error(`Não consegui criar o marcador ${name}`);
  return again.id;
}

/** "Feito": marca com Central/Feito e tira da caixa de entrada. */
export async function markDone(token: string, ids: string[]) {
  const labelId = await ensureLabel(token, "Central/Feito");
  await g(token, "/messages/batchModify", {
    method: "POST",
    body: JSON.stringify({ ids, addLabelIds: [labelId], removeLabelIds: ["INBOX", "UNREAD"] }),
  });
  tirarRotulos(ids, ["INBOX", "UNREAD"]);
}

/** Marca como lidos (não arquiva, não apaga). */
export async function markRead(token: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await g(token, "/messages/batchModify", {
      method: "POST",
      body: JSON.stringify({ ids: ids.slice(i, i + 1000), removeLabelIds: ["UNREAD"] }),
    });
  }
  tirarRotulos(ids, ["UNREAD"]);
}

// --- Envio -------------------------------------------------------------------
const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const encHeader = (s: string) => (/^[\x00-\x7F]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s).toString("base64")}?=`);

/** Envia email (texto simples, com anexo opcional). Se threadId vier, responde na mesma conversa. */
export async function sendMail(
  token: string,
  o: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string;
       anexo?: { nome: string; tipo: string; dados: Buffer } },
): Promise<{ id: string; threadId: string }> {
  const headers = [
    `To: ${o.to}`,
    `Subject: ${encHeader(o.subject)}`,
    "MIME-Version: 1.0",
    ...(o.inReplyTo ? [`In-Reply-To: ${o.inReplyTo}`, `References: ${o.inReplyTo}`] : []),
  ];
  const texto = Buffer.from(o.body, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
  let raw: string;
  if (o.anexo) {
    const bd = "qv" + Date.now().toString(36);
    raw = [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${bd}"`,
      "",
      `--${bd}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      texto,
      `--${bd}`,
      `Content-Type: ${o.anexo.tipo}; name="${o.anexo.nome}"`,
      `Content-Disposition: attachment; filename="${o.anexo.nome}"`,
      "Content-Transfer-Encoding: base64",
      "",
      o.anexo.dados.toString("base64").replace(/.{76}/g, "$&\r\n"),
      `--${bd}--`,
    ].join("\r\n");
  } else {
    raw = [...headers, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", texto].join("\r\n");
  }
  return g(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: b64url(Buffer.from(raw)), ...(o.threadId ? { threadId: o.threadId } : {}) }),
  });
}

/** Resumo de uma conversa: remetentes e o Message-ID da última mensagem (para responder na mesma thread). */
export async function threadInfo(token: string, threadId: string) {
  const t = await g(token, `/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=Message-ID&metadataHeaders=Subject`);
  const msgs = (t.messages || []).map((m: any) => {
    const h = (n: string) => m.payload?.headers?.find((x: any) => x.name.toLowerCase() === n)?.value || "";
    return { from: (h("from").match(/<([^>]+)>/)?.[1] || h("from")).toLowerCase(), messageId: h("message-id"),
      subject: h("subject"), date: new Date(Number(m.internalDate)), snippet: m.snippet || "" };
  });
  return msgs as { from: string; messageId: string; subject: string; date: Date; snippet: string }[];
}
