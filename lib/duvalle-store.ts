// Onde o banco do Duvalle Solo mora (pasta privada do app no Drive) e as rotinas que o mantêm em dia.
import { lerJson, salvarJson } from "./drive";
import { SEED } from "./duvalle-seed";
import { sendMail, threadInfo, searchMail } from "./gmail";
import { EPK_ARQUIVO, FOLLOWUP_DIAS, FOLLOWUP_MAX, novoId, type Banco, type Contato, type Edital } from "./duvalle";

const FILE = "duvalle.json";
const EU = (process.env.ALLOWED_EMAIL || "").toLowerCase();

export const lerBanco = (token: string) => lerJson<Banco>(token, FILE, { contatos: SEED, editais: [], versao: 1 });
export const salvarBanco = (token: string, b: Banco) => salvarJson(token, FILE, b);

const agora = () => new Date().toISOString();

/** Confere respostas nas conversas enviadas. Retorna true se mudou algo. */
export async function conferirRespostas(token: string, b: Banco) {
  let mudou = false;
  for (const c of b.contatos) {
    if (!c.threadId || c.status !== "enviado") continue;
    try {
      const msgs = await threadInfo(token, c.threadId);
      const resposta = msgs.find((m) => m.from && m.from !== EU);
      if (resposta) {
        c.status = "respondeu";
        c.historico.unshift({ data: resposta.date.toISOString(), tipo: "resposta", texto: `Respondeu: ${resposta.snippet.slice(0, 180)}` });
        mudou = true;
      }
    } catch (e: any) {
      console.error("conferir thread", c.nome, e?.message);
    }
  }
  return mudou;
}

/** Contatos que já pedem follow-up (sem resposta há X dias). */
export function followupsDevidos(b: Banco, hoje = new Date()) {
  return b.contatos.filter((c) => {
    if (c.status !== "enviado" || !c.enviadoEm || c.followups >= FOLLOWUP_MAX) return false;
    const ultimo = c.historico.find((h) => h.tipo === "email" || h.tipo === "followup")?.data || c.enviadoEm;
    return hoje.getTime() - new Date(ultimo).getTime() >= FOLLOWUP_DIAS * 86_400_000;
  });
}

async function epk(idioma: Contato["idioma"]) {
  const url = `${process.env.NEXTAUTH_URL}/epk/${EPK_ARQUIVO[idioma]}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Não consegui carregar o press kit para anexar.");
  return { nome: EPK_ARQUIVO[idioma], tipo: "application/pdf", dados: Buffer.from(await r.arrayBuffer()) };
}

export async function enviarPrimeiro(token: string, b: Banco, id: string, assunto: string, corpo: string) {
  const c = b.contatos.find((x) => x.id === id);
  if (!c) throw new Error("Contato não encontrado.");
  if (!c.email) throw new Error("Esse contato ainda não tem email.");
  const r = await sendMail(token, { to: c.email, subject: assunto, body: corpo, anexo: await epk(c.idioma) });
  c.threadId = r.threadId;
  c.status = "enviado";
  c.enviadoEm = agora();
  c.historico.unshift({ data: agora(), tipo: "email", texto: `Email enviado: "${assunto}"` });
}

export async function enviarFollowup(token: string, b: Banco, id: string, texto: string) {
  const c = b.contatos.find((x) => x.id === id);
  if (!c?.threadId || !c.email) throw new Error("Contato sem conversa iniciada.");
  const msgs = await threadInfo(token, c.threadId);
  const ultima = msgs[msgs.length - 1];
  const assunto = ultima?.subject?.startsWith("Re:") ? ultima.subject : `Re: ${ultima?.subject || c.nome}`;
  await sendMail(token, { to: c.email, subject: assunto, body: texto, threadId: c.threadId, inReplyTo: ultima?.messageId });
  c.followups += 1;
  c.historico.unshift({ data: agora(), tipo: "followup", texto: `Follow-up ${c.followups} enviado.` });
}

export async function mandarParaLavinia(token: string, e: Edital, para: string) {
  const corpo = `Oi, Lavínia!

Achei este edital que pode servir para o show solo no baixo de 7 cordas:

${e.titulo}
Órgão: ${e.orgao}
${e.prazo ? `Prazo: ${e.prazo}\n` : ""}${e.valor ? `Valor: ${e.valor}\n` : ""}Link: ${e.link}

${e.resumo}

Consegue dar uma olhada e me dizer se vale inscrever?

Beijo,
Pai`;
  await sendMail(token, { to: para, subject: `Edital para o Duvalle Solo: ${e.titulo}`, body: corpo });
}

/** Lê os boletins do radar de editais (emails "[Radar Duvalle]") e junta os editais novos ao banco. */
export async function importarRadar(token: string, b: Banco) {
  const mails = await searchMail(token, `subject:"Radar Duvalle" newer_than:21d`, 30);
  const vistos = new Set(b.editais.map((e) => e.link));
  let novos = 0;
  for (const m of mails) {
    const bloco = m.body.match(/```json\s*([\s\S]*?)```/)?.[1] || m.body.match(/(\[\s*\{[\s\S]*\}\s*\])/)?.[1];
    if (!bloco) continue;
    try {
      const lista = JSON.parse(bloco);
      for (const x of Array.isArray(lista) ? lista : []) {
        if (!x?.link || !x?.titulo || vistos.has(x.link)) continue;
        vistos.add(x.link);
        b.editais.unshift({
          id: novoId(), titulo: String(x.titulo).slice(0, 200), orgao: String(x.orgao || "").slice(0, 120),
          prazo: x.prazo ? String(x.prazo).slice(0, 60) : undefined, valor: x.valor ? String(x.valor).slice(0, 80) : undefined,
          link: String(x.link), resumo: String(x.resumo || "").slice(0, 600), status: "novo", encontradoEm: m.date.toISOString(),
        });
        novos++;
      }
    } catch { /* boletim mal formatado: ignora */ }
  }
  return novos;
}
