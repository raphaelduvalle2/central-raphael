import { decodeEntities } from "@/lib/gmail";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { buildBriefing, salesSince } from "@/lib/briefing";
import { windowState, WINDOWS } from "@/lib/windows";
import Queue from "./Queue";
import { sortear } from "@/lib/inspira";
import { lerSaldos, lerFeitosYT, DriveScopeError } from "@/lib/drive";
import { comentariosRecentes, YouTubeScopeError } from "@/lib/youtube";
import { contaInstagram, pendenciasInstagram } from "@/lib/instagram";
import { lerBanco, salvarBanco, conferirRespostas, followupsDevidos } from "@/lib/duvalle-store";
import type { Item } from "@/lib/briefing";
import { resumir, atualizadoHoje, type Resumo } from "@/lib/saldos";
import { contasAutomaticas } from "@/lib/pluggy";

import Reentrar from "./Reentrar";
import Atualizar from "./Atualizar";
import Relogio from "./Relogio";

export const dynamic = "force-dynamic";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const hhmm = (s: string) => s.replace(":", "h");
const clock = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);

function Top({ right, live }: { right: string; live?: boolean }) {
  return (
    <div className="top">
      <span className="brand"><i />Qualidade de Vida</span>
      <span className="top-right">
        <span className={`pill ${live ? "live" : ""}`}>{right}</span>
        <Atualizar />
        <Reentrar compact />
      </span>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ agora?: string }> }) {
  const session = await requireSession();
  if (!session || session.error) redirect("/login");

  const { agora } = await searchParams;
  const w = windowState();
  const open = w.open || agora === "1";
  const inspira = sortear();
  const nextLabel = `${w.tomorrow ? "amanhã às " : "às "}${hhmm(w.next)}`;

  let b;
  try {
    b = await buildBriefing(session.accessToken);
  } catch (e: any) {
    console.error("briefing falhou", e?.message);
    const expired = /Gmail 401/.test(String(e?.message));
    return (
      <main className="wrap">
        <Top right="sem conexão" />
        <h1>{expired ? "Sua sessão expirou." : <>O Gmail não <em>respondeu.</em></>}</h1>
        <p className="lead">{expired ? "Entre de novo para continuar." : "Costuma ser passageiro. Tente de novo em um minuto."}</p>
        <a className="btn primary" href={expired ? "/api/auth/signin" : "/"}>{expired ? "Entrar de novo" : "Tentar de novo"}</a>
        <p className="quiet">Detalhe técnico: {String(e?.message || e).slice(0, 160)}</p>
      </main>
    );
  }

  // Fora da janela: só o urgente, sem números.
  if (!open) {
    return (
      <main className="wrap">
        <Top right={`janelas ${WINDOWS.map((x) => hhmm(x.start)).join(" · ")}`} />
        <Queue items={b.items.filter((i) => i.urgent)} mode="urgent" nextLabel={nextLabel} inspira={inspira} />
        <p className="quiet">
          Quer ver tudo antes da hora? <a href="/?agora=1">Abrir a janela agora</a>. Respire antes.
        </p>
        <Relogio aberta={w.open} total={0} />
      </main>
    );
  }

  const { today, month } = b.sales;

  // YouTube: comentários sobre baixo/curso ainda sem resposta (só na janela).
  let yt: Item[] = [];
  let ytPermissao = false;
  let ytStatus = "";
  try {
    const r = await comentariosRecentes(session.accessToken, new Set(await lerFeitosYT(session.accessToken)));
    yt = r.items;
    ytStatus = r.canal
      ? `YouTube (${r.canal}): ${r.lidos} comentários nos últimos 7 dias, ${r.items.length} para você`
      : "YouTube: nenhum canal encontrado nesta conta Google";
  } catch (e) {
    if (e instanceof YouTubeScopeError || e instanceof DriveScopeError) ytPermissao = true;
    else console.error("youtube falhou", (e as any)?.message);
  }

  // Instagram: comentários e DMs relevantes (só na janela).
  let igItems: Item[] = [];
  let igStatus: "desconectado" | "ok" | "erro" = "desconectado";
  let igLinha = "";
  let igErro = "";
  try {
    const conta = await contaInstagram();
    if (conta) {
      const r = await pendenciasInstagram(conta, new Set(await lerFeitosYT(session.accessToken)));
      igItems = r.items;
      igStatus = "ok";
      igLinha = `Instagram (@${conta.username}): ${r.lidos} comentários e mensagens em 7 dias, ${r.items.length} para você`;
    }
  } catch (e) {
    igStatus = "erro";
    igErro = String((e as any)?.message || e).slice(0, 140);
    console.error("instagram falhou", igErro);
  }

  // Duvalle Solo: respostas de produtores (urgente) e follow-ups vencidos.
  let showItems: Item[] = [];
  let threadsSolo = new Set<string>();
  try {
    const banco = await lerBanco(session.accessToken);
    threadsSolo = new Set(banco.contatos.map((c) => c.threadId).filter(Boolean) as string[]);
    if (await conferirRespostas(session.accessToken, banco)) await salvarBanco(session.accessToken, banco);
    const agoraIso = new Date().toISOString();
    const feitos = new Set(await lerFeitosYT(session.accessToken));
    for (const c of banco.contatos.filter((x) => x.status === "respondeu")) {
      // O id inclui a data da resposta: "Feito" esconde esta resposta para sempre, mas uma resposta nova volta a aparecer.
      const r = c.historico.find((h) => h.tipo === "resposta");
      const id = `solo-r-${c.id}-${r?.data || ""}`;
      if (feitos.has(id)) continue;
      showItems.push({ id, source: "duvalle", kind: "show", urgent: true, who: c.nome,
        title: `${c.nome} respondeu`, preview: decodeEntities(r?.texto.replace(/^Respondeu: /, "") || ""),
        date: c.historico[0]?.data || agoraIso, gmailUrl: c.threadId ? `https://mail.google.com/mail/u/0/#all/${c.threadId}` : "",
        actionUrl: "/solo", actionLabel: "Abrir no Duvalle Solo" });
    }
    for (const c of followupsDevidos(banco)) {
      const id = `solo-f-${c.id}-${c.followups}`;
      if (feitos.has(id)) continue;
      showItems.push({ id, source: "duvalle", kind: "show", urgent: false, who: c.nome,
        title: `Follow-up para ${c.nome}`, preview: `Sem resposta há mais de 7 dias. O follow-up ${c.followups + 1} já está escrito, é só revisar e enviar.`,
        date: c.enviadoEm || agoraIso, gmailUrl: "", actionUrl: "/solo", actionLabel: "Revisar e enviar" });
    }
  } catch (e) {
    console.error("duvalle", (e as any)?.message);
  }

  let dinheiro: Resumo | "permissao" | null = null;
  let hojeOk = true;
  let desde: string | null = null;
  try {
    const saldos = await lerSaldos(session.accessToken);
    hojeOk = atualizadoHoje(saldos);
    desde = saldos.atualizadoEm;
    const vendas = saldos.atualizadoEm ? await salesSince(session.accessToken, saldos.atualizadoEm) : [];
    const auto = await contasAutomaticas().catch((e) => { console.error("pluggy", e?.message); return []; });
    dinheiro = resumir(saldos, vendas, new Date(), Object.fromEntries(auto.map((a) => [a.id, a.valor])));
    // Se todas as contas e cartões já são automáticos, a atualização diária manual vira opcional (só saques).
    const manuais = saldos.contas.filter((c) => c.tipo !== "usd" && !c.recebeVendas && c.valor !== 0 && !c.pluggyId);
    if (auto.length && manuais.length === 0) hojeOk = true;
  } catch (e) {
    dinheiro = e instanceof DriveScopeError ? "permissao" : null;
  }

  const fila = [...showItems.filter((i) => i.urgent),
    // Respostas de produtores já aparecem como cartão do Duvalle Solo: não repetir como email comum.
    ...b.items.filter((i) => !(i.kind === "outro" && [...threadsSolo].some((t) => i.gmailUrl.endsWith(`/${t}`)))),
    ...yt, ...igItems, ...showItems.filter((i) => !i.urgent)];

  return (
    <main className="wrap">
      <Top live={w.open} right={w.open ? `janela aberta · fecha em ${w.endsIn} min` : "janela aberta por você"} />
      {dinheiro && dinheiro !== "permissao" && !hojeOk && (
        <a className="daily" href="/saldos">
          <span><b>Saldos de hoje</b> · bancos e saques do Pagar.me · 1 minuto</span>
          <span className="btn primary">Atualizar →</span>
        </a>
      )}
      <Queue items={fila} mode="window" nextLabel={nextLabel} inspira={inspira} />
      {ytPermissao && (
        <div className="list" style={{ padding: "18px 20px", marginTop: 28 }}>
          <p className="meta" style={{ marginTop: 0 }}>Para trazer os comentários do YouTube, o app precisa de uma permissão nova do Google.</p>
          <Reentrar />
        </div>
      )}

      <h2>Dinheiro</h2>
      {dinheiro === "permissao" ? (
        <div className="list" style={{ padding: "18px 20px" }}>
          <p className="meta" style={{ marginTop: 0 }}>Para guardar seus saldos, o app precisa de uma permissão nova do Google.</p>
          <Reentrar />
        </div>
      ) : dinheiro ? (
        <div className="stats" style={{ gridTemplateColumns: "1fr" }}>
          <div className="stat money-card">
            <div>
              <div className="l">Líquido real</div>
              <div className="v" style={{ fontSize: 56 }}>{money(dinheiro.liquido)}</div>
              <div className="l">
                {dinheiro.diasDesde === null
                  ? "valores iniciais da planilha · atualize para começar"
                  : hojeOk ? "saldos de hoje ✓"
                  : `saldos de ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(desde!))}`}
                {dinheiro.projetada && dinheiro.vendasDesde.count > 0 &&
                  ` · ${dinheiro.projetada.nome} +${money(dinheiro.vendasDesde.net)} de ${dinheiro.vendasDesde.count} venda${dinheiro.vendasDesde.count > 1 ? "s" : ""} desde então`}
              </div>
            </div>
            <a className={`btn ${hojeOk ? "" : "primary"}`} href="/saldos">{hojeOk ? "Editar" : "Atualizar"}</a>
          </div>
        </div>
      ) : (
        <p className="meta">Não consegui carregar os saldos agora.</p>
      )}

      <h2>Vendas</h2>
      <div className="stats">
        <div className="stat"><div className="l">Hoje</div><div className="v">{today.count}</div><div className="l">{money(today.net)} líquido</div></div>
        <div className="stat"><div className="l">No mês</div><div className="v">{month.count}</div><div className="l">{money(month.gross)} bruto</div></div>
        <div className="stat"><div className="l">Líquido no mês</div><div className="v">{money(month.net)}</div><div className="l">cartão ≈90% · Pix ≈99%</div></div>
      </div>
      {b.sales.list.length > 0 && (
        <div className="list">
          {b.sales.list.map((s) => (
            <div className="row" key={s.id}>
              <span>{s.who}<span className="meta"> · {s.product}</span></span>
              <span>{money(s.net)}<span className="meta"> · {s.method === "pix" ? "Pix" : "cartão"}</span></span>
            </div>
          ))}
        </div>
      )}

      {b.noise.count > 0 && (
        <>
          <h2>Filtrado para você · {b.noise.count} emails em 24h</h2>
          <div className="list">
            {b.noise.topSenders.map((s) => (
              <div className="row" key={s.from}><span>{s.from}</span><span className="meta">{s.n}</span></div>
            ))}
          </div>
        </>
      )}

      {ytStatus && <p className="quiet" style={{ marginTop: 48, marginBottom: -56 }}>{ytStatus}</p>}
      {igStatus === "ok" && <p className="quiet" style={{ marginTop: 64, marginBottom: -56 }}>{igLinha}</p>}
      {igStatus !== "ok" && (
        <p className="quiet" style={{ marginTop: 64, marginBottom: -56 }}>
          {igStatus === "erro" ? `Instagram: não consegui ler agora (${igErro}).` : "Instagram ainda não conectado (falta INSTAGRAM_TOKEN na Vercel)."}
        </p>
      )}
      <h2>Carreira</h2>
      <a className="solo-link" href="/solo">
        <span><b>Duvalle Solo</b> · prospecção de shows, editais e follow-ups</span><span>→</span>
      </a>

      <p className="quiet">Atualizado às {clock(new Date(b.generatedAt))} · próxima janela {nextLabel}</p>
      <Relogio aberta={w.open} total={fila.length} />
    </main>
  );
}
