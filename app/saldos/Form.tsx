"use client";
import { useMemo, useState } from "react";
import { resumir, type Conta, type Saldos, type Tipo } from "@/lib/saldos";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const GRUPOS: { tipo: Tipo; titulo: string; prefixo: string }[] = [
  { tipo: "brl", titulo: "Contas e plataformas (R$)", prefixo: "R$" },
  { tipo: "usd", titulo: "Em dólar (US$)", prefixo: "US$" },
  { tipo: "cartao", titulo: "Faturas dos cartões (subtrai)", prefixo: "R$" },
];

export default function Form({ inicial }: { inicial: Saldos }) {
  const [contas, setContas] = useState<Conta[]>(inicial.contas);
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(inicial.contas.map((c) => [c.id, String(c.valor).replace(".", ",")])));
  const [dolar, setDolar] = useState(String(inicial.dolar).replace(".", ","));
  const [estado, setEstado] = useState<"" | "salvando" | "ok" | "erro">("");

  const num = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  const preview = useMemo(
    () => resumir({ contas, dolar: num(dolar), atualizadoEm: null }, []),
    [contas, dolar],
  );

  const set = (id: string, patch: Partial<Conta>) => setContas((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = (tipo: Tipo) => {
    const nome = prompt("Nome da conta:");
    if (nome) setContas((cs) => [...cs, { id: `${tipo}-${Date.now()}`, nome, tipo, valor: 0 }]);
  };
  const remove = (id: string) => confirm("Remover esta conta?") && setContas((cs) => cs.filter((c) => c.id !== id));

  async function salvar() {
    setEstado("salvando");
    const res = await fetch("/api/saldos", { method: "POST", body: JSON.stringify({ contas, dolar }) });
    if (res.ok) {
      setEstado("ok");
      setTimeout(() => (window.location.href = "/?agora=1"), 700);
      return;
    }
    const d = await res.json().catch(() => ({}));
    if (d.error === "permissao") { window.location.href = "/saldos"; return; }
    setEstado("erro");
    alert(`Não consegui salvar.\n\nDetalhe: ${d.error || res.status}`);
  }

  return (
    <>
      <div className="stats" style={{ gridTemplateColumns: "1fr" }}>
        <div className="stat">
          <div className="l">Líquido real</div>
          <div className="v" style={{ fontSize: 56 }}>{money(preview.liquido)}</div>
          <div className="l">{money(preview.emContas)} em contas + {money(preview.emDolar)} em dólar − {money(preview.cartoes)} de cartões</div>
        </div>
      </div>

      {GRUPOS.map((g) => (
        <section key={g.tipo}>
          <h2>{g.titulo}</h2>
          <div className="list">
            {contas.filter((c) => c.tipo === g.tipo).map((c) => (
              <div className="row field" key={c.id}>
                <label htmlFor={c.id}>
                  {c.nome}
                  {c.recebeVendas && <span className="meta"> · recebe as vendas</span>}
                </label>
                <span className="inputwrap">
                  <span className="meta">{g.prefixo}</span>
                  <input
                    id={c.id} inputMode="decimal" value={raw[c.id] ?? String(c.valor).replace(".", ",")}
                    onChange={(e) => { setRaw((r) => ({ ...r, [c.id]: e.target.value })); set(c.id, { valor: num(e.target.value) }); }}
                    onFocus={(e) => e.target.select()}
                  />
                  <button className="x" title="Remover" onClick={() => remove(c.id)}>×</button>
                </span>
              </div>
            ))}
          </div>
          <button className="linkish" style={{ marginTop: 10 }} onClick={() => add(g.tipo)}>+ adicionar</button>
        </section>
      ))}

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
          {estado === "salvando" ? "Salvando…" : estado === "ok" ? "Salvo ✓" : "Salvar saldos"}
        </button>
        <a className="btn" href="/?agora=1">Cancelar</a>
      </div>
    </>
  );
}
