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

async function g(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${await res.text()}`);
  return res.json();
}

function decode(data?: string) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
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
      .replace(/&nbsp;|&zwnj;/g, " ")
      .replace(/\s+/g, " ");
  }
  return "";
}

/** Lista e busca mensagens completas, em lotes paralelos. */
export async function searchMail(token: string, q: string, max = 200): Promise<Mail[]> {
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
  const out: Mail[] = [];
  const batch = 15;
  for (let i = 0; i < Math.min(ids.length, max); i += batch) {
    const chunk = ids.slice(i, i + batch);
    const msgs = await Promise.all(chunk.map((id) => g(token, `/messages/${id}?format=full`)));
    for (const m of msgs) {
      const h = (name: string) =>
        m.payload?.headers?.find((x: any) => x.name.toLowerCase() === name)?.value || "";
      out.push({
        id: m.id,
        threadId: m.threadId,
        from: (h("from").match(/<([^>]+)>/)?.[1] || h("from")).toLowerCase(),
        subject: h("subject"),
        date: new Date(Number(m.internalDate)),
        snippet: m.snippet || "",
        body: extractBody(m.payload),
        labels: m.labelIds || [],
      });
    }
  }
  return out;
}

/** Garante que o marcador existe e devolve seu id. */
export async function ensureLabel(token: string, name: string): Promise<string> {
  const r = await g(token, "/labels");
  const found = (r.labels || []).find((l: any) => l.name === name);
  if (found) return found.id;
  const created = await g(token, "/labels", {
    method: "POST",
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  return created.id;
}

/** "Feito": marca com Central/Feito e tira da caixa de entrada. */
export async function markDone(token: string, ids: string[]) {
  const labelId = await ensureLabel(token, "Central/Feito");
  await g(token, "/messages/batchModify", {
    method: "POST",
    body: JSON.stringify({ ids, addLabelIds: [labelId], removeLabelIds: ["INBOX", "UNREAD"] }),
  });
}
