"use client";
import { useMemo, useState } from "react";
import {
  CATEGORIA_LABEL, STATUS_LABEL, emailInicial, emailFollowup, EPK_ARQUIVO,
  type Banco, type Contato, type Status, type Categoria, type Edital,
} from "@/lib/duvalle";

const ORDEM: Status[] = ["respondeu", "negociando", "a_contatar", "pesquisar", "enviado", "fechado", "recusado"];
const quando = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(iso));

async function api(body: any): Promise<Banco> {
  const r = await fetch("/api/solo", { method: "POST", body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Erro ${r.status}`);
  return d.banco;
}

export default function Solo({ inicial, followups }: { inicial: Banco; followups: string[] }) {
  const [b, setB] = useState(inicial);
  const [aba, setAba] = useState<"contatos" | "editais" | "material">("contatos");
  const [filtro, setFiltro] = useState<Status | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);

  const conta = (s: Status) => b.contatos.filter((c) => c.status === s).length;
  const lista = useMemo(() => {
    const q = busca.toLowerCase();
    return b.contatos
      .filter((c) => (filtro === "todos" || c.status === filtro) && (!q || `${c.nome} ${c.cidade} ${c.uf}`.toLowerCase().includes(q)))
      .sort((x, y) => Number(followups.includes(y.id)) - Number(followups.includes(x.id))
        || ORDEM.indexOf(x.status) - ORDEM.indexOf(y.status) || x.nome.localeCompare(y.nome));
  }, [b, filtro, busca, followups]);

  async function acao(body: any) {
    try { setB(await api(body)); return true; } catch (e: any) { alert(e.message); return false; }
  }

  const novosEditais = b.editais.filter((e) => e.status === "novo").length;

  return (
    <>
      <h1>Duvalle <em>Solo.</em></h1>
      <p className="lead">
        {b.contatos.length} contatos · {conta("a_contatar")} prontos para contatar · {conta("enviado")} aguardando resposta
        {conta("respondeu") > 0 && <> · <b style={{ color: "var(--accent)" }}>{conta("respondeu")} responderam</b></>}
        {followups.length > 0 && <> · {followups.length} follow-up{followups.length > 1 ? "s" : ""} para enviar</>}
      </p>

      <div className="tabs">
        <button className={aba === "contatos" ? "on" : ""} onClick={() => setAba("contatos")}>Contatos</button>
        <button className={aba === "editais" ? "on" : ""} onClick={() => setAba("editais")}>
          Editais{novosEditais > 0 && <span className="badge">{novosEditais}</span>}
        </button>
        <button className={aba === "material" ? "on" : ""} onClick={() => setAba("material")}>Material</button>
      </div>

      {aba === "contatos" && (
        <>
          <div className="chips">
            <button className={filtro === "todos" ? "on" : ""} onClick={() => setFiltro("todos")}>Todos {b.contatos.length}</button>
            {ORDEM.map((s) => conta(s) > 0 && (
              <button key={s} className={`${filtro === s ? "on" : ""} st-${s}`} onClick={() => setFiltro(s)}>
                {STATUS_LABEL[s]} {conta(s)}
              </button>
            ))}
          </div>
          <div className="toolbar">
            <input className="search" placeholder="Buscar por nome ou cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <button className="btn" onClick={() => { setNovo(true); setAberto(null); }}>+ Novo contato</button>
          </div>

          {novo && <Ficha contato={null} onSalvar={async (x) => (await acao({ acao: "salvar", contato: x })) && setNovo(false)} onFechar={() => setNovo(false)} />}

          <div className="crm">
            {lista.map((c) => (
              <div key={c.id} className={`crm-row ${aberto === c.id ? "open" : ""}`}>
                <button className="crm-head" onClick={() => setAberto(aberto === c.id ? null : c.id)}>
                  <span className="crm-nome">{c.nome}</span>
                  <span className="crm-meta">{c.cidade}{c.uf ? ` · ${c.uf}` : ""}{c.quando ? ` · ${c.quando}` : ""}</span>
                  <span className="crm-tags">
                    {followups.includes(c.id) && <span className="tag urgent">follow-up</span>}
                    <span className="tag">{CATEGORIA_LABEL[c.categoria]}</span>
                    <span className={`tag st-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                  </span>
                </button>
                {aberto === c.id && (
                  <Detalhe c={c} followupDevido={followups.includes(c.id)} acao={acao} />
                )}
              </div>
            ))}
            {lista.length === 0 && <div className="empty">Nenhum contato aqui.</div>}
          </div>
        </>
      )}

      {aba === "editais" && <Editais editais={b.editais} acao={acao} />}
      {aba === "material" && <Material />}
    </>
  );
}

function Detalhe({ c, followupDevido, acao }: { c: Contato; followupDevido: boolean; acao: (b: any) => Promise<boolean> }) {
  const [modo, setModo] = useState<"ficha" | "email" | "followup">(followupDevido ? "followup" : "ficha");
  const inicial = emailInicial(c);
  const [assunto, setAssunto] = useState(inicial.assunto);
  const [corpo, setCorpo] = useState(inicial.corpo);
  const [fu, setFu] = useState(emailFollowup(c));
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const pesquisa = `https://www.google.com/search?q=${encodeURIComponent(`${c.nome} ${c.cidade} contato email produção curadoria`)}`;

  const run = async (body: any) => { setBusy(true); const ok = await acao(body); setBusy(false); return ok; };

  return (
    <div className="crm-body">
      {c.porque && <p className="porque">{c.porque}</p>}
      <div className="actions" style={{ marginBottom: 18 }}>
        {(c.status === "a_contatar" || c.status === "pesquisar") && (
          <button className={`btn ${c.email ? "primary" : ""}`} disabled={!c.email} onClick={() => setModo("email")}
            title={c.email ? "" : "Preencha o email primeiro"}>Preparar email</button>
        )}
        {c.status === "enviado" && c.followups < 2 && <button className="btn" onClick={() => setModo("followup")}>Follow-up</button>}
        {c.threadId && (
          <a className="btn" target="_blank" rel="noreferrer" href={`https://mail.google.com/mail/u/0/#all/${c.threadId}`}>Ver conversa</a>
        )}
        {!c.email && <a className="btn primary" href={pesquisa} target="_blank" rel="noreferrer">Pesquisar contato</a>}
        {c.site && <a className="btn" href={c.site} target="_blank" rel="noreferrer">Site</a>}
        {c.fonte && <a className="btn" href={c.fonte} target="_blank" rel="noreferrer">Fonte</a>}
        <button className="btn" onClick={() => setModo("ficha")}>Editar ficha</button>
      </div>

      {modo === "ficha" && <Ficha contato={c} onSalvar={(x) => run({ acao: "salvar", contato: { ...x, id: c.id } })} />}

      {modo === "email" && (
        <div className="compose">
          <label>Assunto<input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></label>
          <label>Mensagem<textarea rows={16} value={corpo} onChange={(e) => setCorpo(e.target.value)} /></label>
          <p className="meta">Para: {c.email} · vai com o press kit em anexo ({EPK_ARQUIVO[c.idioma]}).</p>
          <div className="actions">
            <button className="btn primary" disabled={busy} onClick={async () => (await run({ acao: "enviar", id: c.id, assunto, corpo })) && setModo("ficha")}>
              {busy ? "Enviando…" : "Enviar email"}
            </button>
            <button className="btn" onClick={() => setModo("ficha")}>Cancelar</button>
          </div>
        </div>
      )}

      {modo === "followup" && (
        <div className="compose">
          <label>Follow-up {c.followups + 1} de 2 (responde na mesma conversa)<textarea rows={7} value={fu} onChange={(e) => setFu(e.target.value)} /></label>
          <div className="actions">
            <button className="btn primary" disabled={busy} onClick={async () => (await run({ acao: "followup", id: c.id, texto: fu })) && setModo("ficha")}>
              {busy ? "Enviando…" : "Enviar follow-up"}
            </button>
            <button className="btn" onClick={() => setModo("ficha")}>Agora não</button>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 30 }}>Histórico</h2>
      <div className="nota">
        <input placeholder="Anotar algo (ligação, conversa, combinado)…" value={nota} onChange={(e) => setNota(e.target.value)} />
        <button className="btn" disabled={!nota.trim() || busy} onClick={async () => (await run({ acao: "nota", id: c.id, texto: nota })) && setNota("")}>Anotar</button>
      </div>
      <ul className="hist">
        {c.historico.map((h, i) => <li key={i}><span className="meta">{quando(h.data)}</span> {h.texto}</li>)}
      </ul>
      <button className="linkish" style={{ marginTop: 14 }} onClick={() => confirm(`Excluir ${c.nome}?`) && run({ acao: "excluir", id: c.id })}>Excluir contato</button>
    </div>
  );
}

function Ficha({ contato, onSalvar, onFechar }: { contato: Contato | null; onSalvar: (x: any) => any; onFechar?: () => void }) {
  const [f, setF] = useState<any>(contato || { nome: "", cidade: "", uf: "", categoria: "jazz", idioma: "pt", status: "pesquisar" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const campo = (k: string, label: string, ph = "") => (
    <label>{label}<input value={f[k] || ""} placeholder={ph} onChange={set(k)} /></label>
  );
  return (
    <div className={`ficha ${contato ? "" : "nova"}`}>
      <div className="grid2">
        {campo("nome", "Nome do evento / local")}
        {campo("email", "Email", "produção@…")}
        {campo("cidade", "Cidade")}
        {campo("uf", "UF")}
        {campo("telefone", "Telefone / WhatsApp")}
        {campo("instagram", "Instagram")}
        {campo("site", "Site")}
        {campo("quando", "Quando acontece")}
        <label>Categoria
          <select value={f.categoria} onChange={set("categoria")}>
            {(Object.keys(CATEGORIA_LABEL) as Categoria[]).map((k) => <option key={k} value={k}>{CATEGORIA_LABEL[k]}</option>)}
          </select>
        </label>
        <label>Status
          <select value={f.status} onChange={set("status")}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          </select>
        </label>
        <label>Idioma do email
          <select value={f.idioma} onChange={set("idioma")}>
            <option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option>
          </select>
        </label>
      </div>
      <label>Por que combina (entra no email)<textarea rows={2} value={f.porque || ""} onChange={set("porque")} /></label>
      <label>Como contatar / quem procurar<textarea rows={2} value={f.como || ""} onChange={set("como")} /></label>
      <div className="actions">
        <button className="btn primary" disabled={!f.nome?.trim()} onClick={() => onSalvar(f)}>Salvar</button>
        {onFechar && <button className="btn" onClick={onFechar}>Cancelar</button>}
      </div>
    </div>
  );
}

function Editais({ editais, acao }: { editais: Edital[]; acao: (b: any) => Promise<boolean> }) {
  const ativos = editais.filter((e) => e.status !== "descartado");
  if (ativos.length === 0)
    return (
      <div className="empty" style={{ textAlign: "left" }}>
        Nenhum edital ainda. Todo dia de manhã o radar pesquisa editais e chamadas abertas pelo Brasil (Sesc, Funarte, PNAB,
        secretarias de cultura, festivais) e eles aparecem aqui. Daí você manda para a Lavínia em 1 clique.
      </div>
    );
  const LAB: Record<Edital["status"], string> = { novo: "Novo", lavinia: "Com a Lavínia", inscrito: "Inscrito", resultado: "Resultado", descartado: "Descartado" };
  return (
    <div className="crm">
      {ativos.map((e) => (
        <div key={e.id} className="crm-row open">
          <div className="crm-body" style={{ paddingTop: 18 }}>
            <div className="kicker"><span className={`tag ${e.status === "novo" ? "urgent" : ""}`}>{LAB[e.status]}</span>
              <span>{e.orgao}</span>{e.prazo && <span>· prazo {e.prazo}</span>}{e.valor && <span>· {e.valor}</span>}</div>
            <div className="title" style={{ fontSize: 18, marginBottom: 8 }}>{e.titulo}</div>
            <p className="porque">{e.resumo}</p>
            <div className="actions">
              <a className="btn" href={e.link} target="_blank" rel="noreferrer">Abrir edital</a>
              {e.status === "novo" && <button className="btn primary" onClick={() => acao({ acao: "lavinia", id: e.id })}>Mandar para a Lavínia</button>}
              {e.status === "lavinia" && <button className="btn" onClick={() => acao({ acao: "edital-status", id: e.id, status: "inscrito" })}>Marcar inscrito</button>}
              {e.status === "inscrito" && <button className="btn" onClick={() => acao({ acao: "edital-status", id: e.id, status: "resultado" })}>Saiu o resultado</button>}
              <button className="btn" onClick={() => acao({ acao: "edital-status", id: e.id, status: "descartado" })}>Descartar</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Material() {
  return (
    <div className="list" style={{ padding: "6px 20px" }}>
      <div className="row"><span>Press kit em português</span><a href="/epk/raphael-du-valle-epk-pt.pdf" target="_blank">abrir</a></div>
      <div className="row"><span>Press kit em inglês</span><a href="/epk/raphael-du-valle-epk-en.pdf" target="_blank">abrir</a></div>
      <div className="row"><span>Press kit em espanhol</span><a href="/epk/raphael-du-valle-epk-es.pdf" target="_blank">abrir</a></div>
      <div className="row"><span>Rider técnico (solo)</span><a href="/epk/rider-solo.jpg" target="_blank">abrir</a></div>
      <div className="row"><span>Site</span><a href="https://www.raphaelduvalle.com" target="_blank">raphaelduvalle.com</a></div>
    </div>
  );
}
