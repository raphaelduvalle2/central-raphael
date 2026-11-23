import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { lerBanco, salvarBanco, enviarPrimeiro, enviarFollowup, mandarParaLavinia } from "@/lib/duvalle-store";
import { LAVINIA, novoId, type Contato, type Status, type EditalStatus } from "@/lib/duvalle";

const STATUS: Status[] = ["pesquisar", "a_contatar", "enviado", "respondeu", "negociando", "fechado", "recusado"];
const ED_STATUS: EditalStatus[] = ["novo", "lavinia", "inscrito", "resultado", "descartado"];
const txt = (v: any, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);

function limparContato(x: any, base?: Contato): Contato {
  const email = txt(x.email, 200);
  return {
    ...(base || { id: novoId(), followups: 0, historico: [{ data: new Date().toISOString(), tipo: "nota", texto: "Contato criado." }] }),
    nome: txt(x.nome, 160) || base?.nome || "Sem nome",
    cidade: txt(x.cidade, 100) ?? base?.cidade ?? "",
    uf: (txt(x.uf, 2) ?? base?.uf ?? "").toUpperCase(),
    categoria: ["jazz", "gastronomia", "literario", "sesc", "cultural"].includes(x.categoria) ? x.categoria : base?.categoria || "cultural",
    quando: txt(x.quando, 80) ?? base?.quando,
    site: txt(x.site, 300) ?? base?.site,
    email: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : email === "" ? undefined : base?.email,
    telefone: txt(x.telefone, 40) ?? base?.telefone,
    instagram: txt(x.instagram, 120) ?? base?.instagram,
    como: txt(x.como, 400) ?? base?.como,
    porque: txt(x.porque, 400) ?? base?.porque,
    fonte: base?.fonte ?? txt(x.fonte, 400),
    idioma: ["pt", "en", "es"].includes(x.idioma) ? x.idioma : base?.idioma || "pt",
    status: STATUS.includes(x.status) ? x.status : base?.status || "pesquisar",
  } as Contato;
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const token = session.accessToken;
  const p = await req.json();
  try {
    const b = await lerBanco(token);
    const achar = (id: string) => b.contatos.find((c) => c.id === id);

    switch (p.acao) {
      case "salvar": {
        const atual = p.contato?.id ? achar(p.contato.id) : undefined;
        const c = limparContato(p.contato || {}, atual);
        // Ganhou email: sai de "achar contato" e vai para "a contatar".
        if (c.status === "pesquisar" && c.email) c.status = "a_contatar";
        if (atual && atual.status !== c.status)
          c.historico.unshift({ data: new Date().toISOString(), tipo: "status", texto: `Status: ${c.status}` });
        if (atual) Object.assign(atual, c);
        else b.contatos.unshift(c);
        break;
      }
      case "excluir":
        b.contatos = b.contatos.filter((c) => c.id !== p.id);
        break;
      case "nota": {
        const c = achar(p.id);
        if (c && txt(p.texto, 1000)) c.historico.unshift({ data: new Date().toISOString(), tipo: "nota", texto: txt(p.texto, 1000)! });
        break;
      }
      case "enviar":
        await enviarPrimeiro(token, b, p.id, txt(p.assunto, 200) || "", txt(p.corpo, 8000) || "");
        break;
      case "followup":
        await enviarFollowup(token, b, p.id, txt(p.texto, 4000) || "");
        break;
      case "edital-status": {
        const e = b.editais.find((x) => x.id === p.id);
        if (e && ED_STATUS.includes(p.status)) e.status = p.status;
        break;
      }
      case "lavinia": {
        const e = b.editais.find((x) => x.id === p.id);
        if (!e) throw new Error("Edital não encontrado.");
        await mandarParaLavinia(token, e, LAVINIA);
        e.status = "lavinia";
        break;
      }
      default:
        return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });
    }
    await salvarBanco(token, b);
    return NextResponse.json({ ok: true, banco: b });
  } catch (e: any) {
    console.error("solo", p?.acao, e?.message);
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
