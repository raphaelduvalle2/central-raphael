import { searchMail, type Mail } from "./gmail";

const TZ = "America/Sao_Paulo";
const ESCOLA = "escola@toquemaisbaixo.com.br";
const AVISOS = "avisos@toquemaisbaixo.com.br";
const LEVVEX = "noreply@levvex.com";
const GUI = (process.env.GUI_EMAIL || "contato@guimuniz.com").toLowerCase();

export type Kind = "chamado" | "duvida" | "video" | "gui" | "outro";

export type Item = {
  id: string;
  kind: Kind;
  title: string;
  who: string;
  preview: string;
  date: string; // ISO
  urgent: boolean;
  gmailUrl: string;
  actionUrl?: string;
  actionLabel?: string;
  extraUrl?: string;
  extraLabel?: string;
};

export type Sale = { id: string; date: string; who: string; product: string; gross: number; net?: number };

export type Briefing = {
  items: Item[];
  sales: {
    today: { count: number; gross: number; net: number };
    month: { count: number; gross: number; net: number; netKnown: number };
    list: Sale[];
  };
  noise: { count: number; topSenders: { from: string; n: number }[] };
  generatedAt: string;
};

const brl = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const gmailUrl = (m: Mail) => `https://mail.google.com/mail/u/0/#all/${m.threadId}`;
const firstUrl = (body: string, host: string) =>
  body.match(new RegExp(`https?://(?:www\\.)?${host.replace(/\./g, "\\.")}[^\\s)\\]"']*`))?.[0];
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** Primeira linha útil do corpo (a mensagem do aluno, nos avisos da escola). */
function previewOf(m: Mail) {
  const lines = m.body.split("\n").map((l) => l.trim()).filter(Boolean);
  const line = lines.find((l) => l !== m.subject.trim() && !l.startsWith("|"));
  return (line || m.snippet).slice(0, 220);
}

function classify(m: Mail): Item | null {
  const base = { id: m.id, date: m.date.toISOString(), gmailUrl: gmailUrl(m), preview: previewOf(m) };
  if (m.from === ESCOLA) {
    const tmbx = firstUrl(m.body, "tmbx.com.br");
    const parts = m.subject.split("·").map((s) => s.trim());
    const who = parts[parts.length - 1] || "";
    if (/^chamado/i.test(m.subject))
      return { ...base, kind: "chamado", urgent: true, who, title: parts.slice(0, 2).join(" · "),
        actionUrl: tmbx, actionLabel: "Responder no TMBX" };
    if (/^d[úu]vida/i.test(m.subject))
      return { ...base, kind: "duvida", urgent: true, who, title: parts[0],
        actionUrl: tmbx, actionLabel: "Responder no TMBX" };
    if (/v[íi]deo para aprovar/i.test(m.subject))
      return { ...base, kind: "video", urgent: false, who, title: parts.length > 2 ? parts[1] : "Vídeo para aprovar",
        actionUrl: tmbx, actionLabel: "Aprovar ou recusar",
        extraUrl: firstUrl(m.body, "youtube.com"), extraLabel: "Assistir" };
    return { ...base, kind: "outro", urgent: false, who: "Escola", title: m.subject };
  }
  if (m.from === GUI) return { ...base, kind: "gui", urgent: true, who: "Gui", title: m.subject || "(sem assunto)" };
  return null;
}

/** Remetentes que nunca pedem decisão: só entram na contagem de ruído. */
const NOISE = [AVISOS, LEVVEX, "nubank.com.br", "mercadopago.com", "google.com", "youtube.com",
  "canva.com", "apple.com", "openai.com", "jotform.com", "contato@toquemaisbaixo.com.br"];

export async function buildBriefing(token: string): Promise<Briefing> {
  const now = new Date();
  const monthStart = ymd(now).slice(0, 8).replace(/-/g, "/") + "01";
  const [decide, salesMail, inbox] = await Promise.all([
    searchMail(token, `in:inbox -label:Central/Feito {from:${ESCOLA} from:${GUI}} newer_than:30d`, 60),
    searchMail(token, `{from:${AVISOS} from:${LEVVEX}} after:${monthStart}`, 400),
    searchMail(token, `in:inbox newer_than:1d`, 80),
  ]);
  return assemble(decide, salesMail, inbox, now);
}

/** Parte pura (testável): transforma emails em briefing. */
export function assemble(decide: Mail[], salesMail: Mail[], inbox: Mail[], now: Date): Briefing {
  const today = ymd(now);

  const items = decide.map(classify).filter(Boolean) as Item[];
  // Emails pessoais de remetentes desconhecidos (ex.: contratante de show) entram em "Quando der".
  const known = new Set(items.map((i) => i.id));
  inbox
    .filter((x) => !known.has(x.id) && x.labels.includes("CATEGORY_PERSONAL") && !NOISE.some((n) => x.from.includes(n)))
    .forEach((x) => items.push({ id: x.id, kind: "outro", urgent: false, who: x.from, title: x.subject || "(sem assunto)",
      preview: x.snippet.slice(0, 220), date: x.date.toISOString(), gmailUrl: gmailUrl(x) }));
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.date.localeCompare(a.date));

  // Vendas: o aviso do TMBX é a fonte (nome, produto, bruto); a Levvex completa o líquido.
  const levvex = salesMail
    .filter((m) => m.from === LEVVEX)
    .map((m) => ({
      who: (m.body.match(/Cliente:\s*(.+)/)?.[1] || "").trim().toLowerCase(),
      net: brl(m.body.match(/Voc[êe] recebe\s*R\$\s*([\d.,]+)/)?.[1] || "NaN"),
      t: m.date.getTime(),
      used: false,
    }));
  const sales: Sale[] = salesMail
    .filter((m) => m.from === AVISOS && /^Venda:/i.test(m.subject))
    .map((m) => {
      const parts = m.subject.split("·").map((s) => s.trim());
      const product = (parts[0] || "").replace(/^Venda:\s*/i, "");
      const value = parts[1] || "";
      const who = parts.slice(2).join(" · ");
      const gross = brl(value.replace(/R\$\s*/, ""));
      const match = levvex.find((l) => !l.used && l.who === who.toLowerCase() && Math.abs(l.t - m.date.getTime()) < 30 * 60_000);
      if (match) match.used = true;
      return { id: m.id, date: m.date.toISOString(), who, product, gross,
        net: match && Number.isFinite(match.net) ? match.net : undefined };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const sum = (list: Sale[]) => ({
    count: list.length,
    gross: list.reduce((s, x) => s + (x.gross || 0), 0),
    net: list.reduce((s, x) => s + (x.net ?? 0), 0),
    netKnown: list.filter((x) => x.net !== undefined).length,
  });
  const todaySales = sales.filter((s) => ymd(new Date(s.date)) === today);
  const m = sum(sales);
  const t = sum(todaySales);

  const decidedIds = new Set(items.map((i) => i.id));
  const noiseMail = inbox.filter((x) => !decidedIds.has(x.id));
  const counts = new Map<string, number>();
  noiseMail.forEach((x) => {
    const key = NOISE.find((n) => x.from.includes(n)) || x.from;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return {
    items,
    sales: { today: { count: t.count, gross: t.gross, net: t.net }, month: m, list: sales.slice(0, 12) },
    noise: {
      count: noiseMail.length,
      topSenders: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([from, n]) => ({ from, n })),
    },
    generatedAt: now.toISOString(),
  };
}
