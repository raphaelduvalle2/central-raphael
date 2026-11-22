import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { buildBriefing } from "@/lib/briefing";
import { windowState, WINDOWS } from "@/lib/windows";
import Items from "./Items";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const hhmm = (s: string) => s.replace(":", "h");

export default async function Home({ searchParams }: { searchParams: Promise<{ agora?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.error) redirect("/login");

  const { agora } = await searchParams;
  const w = windowState();
  const open = w.open || agora === "1";

  const b = await buildBriefing(session.accessToken);
  const urgent = b.items.filter((i) => i.urgent);
  const nextLabel = `${w.tomorrow ? "amanhã às " : "às "}${hhmm(w.next)}`;

  // Fora da janela: tela calma. Só o urgente aparece, sem números de vendas.
  if (!open) {
    return (
      <main className="wrap">
        <div className="top"><b>Central</b><span>janelas: {WINDOWS.map((x) => hhmm(x.start)).join(" · ")}</span></div>
        {urgent.length === 0 ? (
          <section className="calm">
            <div className="dot" />
            <h1>Nada precisa de você agora.</h1>
            <p className="lead">Próxima janela de decisão {nextLabel}. Pode fechar esta aba.</p>
          </section>
        ) : (
          <>
            <h1>{urgent.length === 1 ? "Uma coisa" : `${urgent.length} coisas`} pede{urgent.length === 1 ? "" : "m"} você.</h1>
            <p className="lead">Só o urgente. O resto espera a janela {nextLabel}.</p>
            <Items items={urgent} />
          </>
        )}
        <p className="quiet">
          Quer ver tudo antes da hora? <a href="/?agora=1">Abrir a janela agora</a>. Respire antes.
        </p>
      </main>
    );
  }

  const others = b.items.filter((i) => !i.urgent);
  const { today, month } = b.sales;

  return (
    <main className="wrap">
      <div className="top">
        <b>Central</b>
        <span>{w.open ? `janela aberta · fecha em ${w.endsIn} min` : "fora da janela"}</span>
      </div>
      <h1>{b.items.length === 0 ? "Tudo em dia." : `${b.items.length} decis${b.items.length === 1 ? "ão" : "ões"} para tomar.`}</h1>
      <p className="lead">
        Resolva, marque como feito e feche. {b.noise.count > 0 && `${b.noise.count} emails das últimas 24h não precisavam de você.`}
      </p>

      <h2>Precisa de você</h2>
      <Items items={urgent} />

      {others.length > 0 && (
        <>
          <h2>Quando der</h2>
          <Items items={others} />
        </>
      )}

      <h2>Vendas</h2>
      <div className="stats">
        <div className="card stat"><div className="l">Hoje</div><div className="v">{today.count}</div><div className="l">{money(today.net)} líquido</div></div>
        <div className="card stat"><div className="l">No mês</div><div className="v">{month.count}</div><div className="l">{money(month.gross)} bruto</div></div>
        <div className="card stat">
          <div className="l">Líquido no mês</div><div className="v">{money(month.net)}</div>
          <div className="l">estimado · cartão ≈90% · Pix ≈99%</div>
        </div>
      </div>
      {b.sales.list.length > 0 && (
        <div className="card">
          {b.sales.list.map((s) => (
            <div className="row" key={s.id}>
              <span>{s.who}<span className="meta"> · {s.product}</span></span>
              <span>{money(s.net)}<span className="meta"> · {s.method === "pix" ? "Pix" : "cartão"}</span></span>
            </div>
          ))}
        </div>
      )}

      {b.noise.topSenders.length > 0 && (
        <>
          <h2>Filtrado para você</h2>
          <div className="card">
            {b.noise.topSenders.map((s) => (
              <div className="row" key={s.from}><span>{s.from}</span><span className="meta">{s.n}</span></div>
            ))}
          </div>
        </>
      )}

      <p className="quiet">
        Atualizado às {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(b.generatedAt))}.
        Próxima janela {nextLabel}.
      </p>
    </main>
  );
}
