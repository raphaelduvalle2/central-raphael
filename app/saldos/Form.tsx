"use client";
import { useMemo, useState } from "react";
import { resumir, type Conta, type Saldos, type Tipo } from "@/lib/saldos";
import type { ContaAuto } from "@/lib/pluggy";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

const GRUPOS: { tipo: Tipo; titulo: string; prefixo: string }[] = [
  { tipo: "brl", titulo: "Contas e plataformas (R$)", prefixo: "R$" },
  { tipo: "usd", titulo: "Em dólar (US$)", prefixo: "US$" },
  { tipo: "cartao", titulo: "Faturas dos cartões (subtrai)", prefixo: "R$" },
];

export default function Form({ inicial, vendas, auto = [], autoStatus = "off" }: {
  inicial: Saldos; vendas: { count: number; net: number }; auto?: ContaAuto[]; autoStatus?: string;
}) {
  const autoMap = Object.fromEntries(auto.map((a) => [a.id, a]));
  const quando = (iso?: string) => iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
  // Pagar.me já começa com as vendas desde a última atualização somadas.
  const [contas, setContas] = useState<Conta[]>(() =>
    inicial.contas.map((c) => (c.recebeVendas ? { ...c, valor: Math.round((c.valor + vendas.net) * 100) / 100 } : c)));
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(contas.map((c) => [c.id, fmt(c.valor)])));
  const [dolar, setDolar] = useState(fmt(inicial.dolar));
  const [saque, setSaque] = useState("");
  const [verZeradas, setVerZeradas] = useState(false);
  const [estado, setEstado] = useState<"" | "salvando" | "ok">("");

  const receptora = contas.find((c) => c.recebeVendas);
  // O que vai ser salvo: Pagar.me menos o saque informado.
  const final = useMemo(
    () => contas.map((c) =>
      c.recebeVendas ? { ...c, valor: Math.round((c.valor - num(saque)) * 100) / 100 }
      // Conta automática: guarda o último valor lido, para valer caso o Open Finance fique fora do ar.
      : c.pluggyId && autoMap[c.pluggyId] ? { ...c, valor: autoMap[c.pluggyId].valor } : c),
    [contas, saque, auto],
  );
  const preview = useMemo(
    () => resumir({ contas: final, dolar: num(dolar), atualizadoEm: null }, [], new Date(), Object.fromEntries(auto.map((a) => [a.id, a.valor]))),
    [final, dolar, auto]);
  const ligadas = new Set(contas.map((c) => c.pluggyId).filter(Boolean));
  const soltas = auto.filter((a) => !ligadas.has(a.id));
  const ligar = (id: string, pluggyId: string) =>
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, pluggyId: pluggyId || undefined } : c)));
  const adicionarAuto = (a: ContaAuto) => {
    const id = `auto-${a.id.slice(0, 8)}`;
    setContas((cs) => [...cs, { id, nome: a.nome, tipo: a.tipo, valor: a.valor, pluggyId: a.id }]);
    setRaw((r) => ({ ...r, [id]: fmt(a.valor) }));
  };

  const setValor = (id: string, v: string) => {
    setRaw((r) => ({ ...r, [id]: v }));
    setContas((cs) => cs.map((c) => (c.id === id ? { ...c, valor: num(v) } : c)));
  };
  const add = (tipo: Tipo) => {
    const nome = prompt("Nome da conta:");
    if (!nome) return;
    const id = `${tipo}-${Date.now()}`;
    setContas((cs) => [...cs, { id, nome, tipo, valor: 0 }]);
    setRaw((r) => ({ ...r, [id]: "0" }));
    setVerZeradas(true);
  };
  const remove = (id: string) => confirm("Remover esta conta?") && setContas((cs) => cs.filter((c) => c.id !== id));

  async function salvar() {
    setEstado("salvando");
    const res = await fetch("/api/saldos", { method: "POST", body: JSON.stringify({ contas: final, dolar }) });
    if (res.ok) {
      setEstado("ok");
      setTimeout(() => (window.location.href = "/?agora=1"), 700);
      return;
    }
    setEstado("");
    const d = await res.json().catch(() => ({}));
    if (d.error === "permissao") return void (window.location.href = "/saldos");
    alert(`Não consegui salvar.\n\nDetalhe: ${d.error || res.status}`);
  }

  // Contas zeradas ficam recolhidas (exceto a do Pagar.me) para a atualização diária ser rápida.
  const visivel = (c: Conta) => verZeradas || c.valor !== 0 || c.recebeVendas;
  const zeradas = contas.filter((c) => !visivel(c)).length;

  return (
    <>
      <div className="stats" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat">
          <div className="l">Líquido real</div>
          <div className="v" style={{ fontSize: 56 }}>{money(preview.liquido)}</div>
          <div className="l">
            {money(preview.emContas)} em contas + {money(preview.emDolar)} em dólar − {money(preview.cartoes)} de cartões
          </div>
        </div>
      </div>

      <div className={`auto-box ${autoStatus === "ok" ? "ok" : ""}`}>
        {autoStatus === "off" && <>Saldos automáticos (Open Finance) ainda não configurados.</>}
        {autoStatus.startsWith("erro") && <>Não consegui ler os saldos automáticos agora ({autoStatus.slice(6)}). Os valores manuais continuam valendo.</>}
        {autoStatus === "ok" && <>Open Finance conectado: {auto.length} conta{auto.length === 1 ? "" : "s"} e cartões lidos automaticamente.
          {soltas.length > 0 && <> Ligue cada um a uma conta abaixo (campo "manual/automático") ou adicione:</>}</>}
        {soltas.length > 0 && (
          <div className="auto-list">
            {soltas.map((a) => (
              <button key={a.id} className="btn" onClick={() => adicionarAuto(a)}>
                + {a.nome} · {money(a.valor)}{a.tipo === "cartao" ? " (fatura)" : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {receptora && (
        <>
          <h2>Saque do {receptora.nome}</h2>
          <div className="list">
            <div className="row field">
              <label htmlFor="saque">
                Sacou hoje?
                <span className="hint">Desconta do {receptora.nome}. Lembre de atualizar o banco que recebeu.</span>
              </label>
              <span className="inputwrap"><span className="meta">R$</span>
                <input id="saque" inputMode="decimal" placeholder="0" value={saque} onChange={(e) => setSaque(e.target.value)} />
              </span>
            </div>
          </div>
        </>
      )}

      {GRUPOS.map((g) => {
        const lista = contas.filter((c) => c.tipo === g.tipo && visivel(c));
        return (
          <section key={g.tipo}>
            <h2>{g.titulo}</h2>
            {lista.length > 0 && (
              <div className="list">
                {lista.map((c) => (
                  <div className="row field" key={c.id}>
                    <label htmlFor={c.id}>
                      {c.nome}
                      {g.tipo !== "usd" && !c.recebeVendas && auto.length > 0 && (
                        <select className="auto-sel" value={c.pluggyId || ""} onChange={(e) => ligar(c.id, e.target.value)}>
                          <option value="">manual</option>
                          {auto.filter((a) => a.tipo === g.tipo).map((a) => <option key={a.id} value={a.id}>automático: {a.nome}</option>)}
                        </select>
                      )}
                      {c.pluggyId && autoMap[c.pluggyId] && (
                        <span className="hint">automático · atualizado {quando(autoMap[c.pluggyId].atualizadoEm)}</span>
                      )}
                      {c.recebeVendas && (
                        <span className="hint">
                          {vendas.count > 0
                            ? `já inclui +${money(vendas.net)} de ${vendas.count} venda${vendas.count > 1 ? "s" : ""} desde a última vez`
                            : "recebe as vendas"}
                          {num(saque) > 0 && ` · após saque: ${money(c.valor - num(saque))}`}
                        </span>
                      )}
                    </label>
                    <span className="inputwrap">
                      <span className="meta">{g.prefixo}</span>
                      <input id={c.id} inputMode="decimal"
                        value={c.pluggyId && autoMap[c.pluggyId] ? fmt(autoMap[c.pluggyId].valor) : raw[c.id] ?? fmt(c.valor)}
                        disabled={Boolean(c.pluggyId && autoMap[c.pluggyId])}
                        onChange={(e) => setValor(c.id, e.target.value)} onFocus={(e) => e.target.select()} />
                      <button className="x" title="Remover" onClick={() => remove(c.id)}>×</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button className="linkish" style={{ marginTop: 10 }} onClick={() => add(g.tipo)}>+ adicionar</button>
          </section>
        );
      })}

      {zeradas > 0 && (
        <p style={{ marginTop: 28 }}>
          <button className="linkish" onClick={() => setVerZeradas(true)}>Mostrar {zeradas} contas zeradas</button>
        </p>
      )}

      <h2>Cotação</h2>
      <div className="list">
        <div className="row field">
          <label htmlFor="dolar">Dólar</label>
          <span className="inputwrap"><span className="meta">R$</span>
            <input id="dolar" inputMode="decimal" value={dolar} onChange={(e) => setDolar(e.target.value)} onFocus={(e) => e.target.select()} />
          </span>
        </div>
      </div>

      <div className="actions" style={{ marginTop: 36 }}>
        <button className="btn primary" disabled={estado === "salvando"} onClick={salvar}>
          {estado === "salvando" ? "Salvando…" : estado === "ok" ? "Salvo ✓" : "Salvar saldos de hoje"}
        </button>
        <a className="btn" href="/?agora=1">Cancelar</a>
      </div>
    </>
  );
}
