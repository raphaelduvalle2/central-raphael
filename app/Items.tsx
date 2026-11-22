"use client";
import { useState } from "react";
import type { Item } from "@/lib/briefing";

const LABEL: Record<Item["kind"], string> = {
  chamado: "Chamado",
  duvida: "Dúvida",
  video: "Vídeo",
  gui: "Gui",
  outro: "Outro",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso));

export default function Items({ items }: { items: Item[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const visible = items.filter((i) => !hidden.has(i.id));

  async function done(id: string) {
    setBusy(id);
    const res = await fetch("/api/feito", { method: "POST", body: JSON.stringify({ ids: [id] }) });
    setBusy(null);
    if (res.ok) setHidden((s) => new Set(s).add(id));
    else alert("Não consegui marcar como feito. Tente de novo.");
  }

  if (visible.length === 0) return <div className="card empty">Nada esperando por você. ✓</div>;

  return (
    <>
      {visible.map((i) => (
        <div key={i.id} className={`card item ${i.urgent ? "urgent" : ""}`}>
          <div className="meta">
            <span className={`tag ${i.urgent ? "urgent" : ""}`}>{LABEL[i.kind]}</span>
            {i.who} · {when(i.date)}
          </div>
          <div className="title">{i.title}</div>
          {i.preview && <div className="preview">{i.preview}</div>}
          <div className="actions">
            {i.actionUrl && (
              <a className="btn primary" href={i.actionUrl} target="_blank" rel="noreferrer">{i.actionLabel}</a>
            )}
            {i.extraUrl && (
              <a className="btn" href={i.extraUrl} target="_blank" rel="noreferrer">{i.extraLabel}</a>
            )}
            <a className="btn" href={i.gmailUrl} target="_blank" rel="noreferrer">Ver email</a>
            <button className="btn done" disabled={busy === i.id} onClick={() => done(i.id)}>
              {busy === i.id ? "…" : "Feito ✓"}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
