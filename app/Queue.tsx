"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/briefing";

const LABEL: Record<Item["kind"], string> = { chamado: "Chamado", duvida: "Dúvida", video: "Vídeo", gui: "Gui", outro: "Email", youtube: "YouTube" };
const TZ = "America/Sao_Paulo";
const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const day = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

/** Fila de decisões: mostra uma por vez. Feito = some; Pular = vai para o fim. */
export default function Queue({
  items, mode, nextLabel,
}: { items: Item[]; mode: "urgent" | "window"; nextLabel: string }) {
  const [queue, setQueue] = useState(items);
  const [doneCount, setDoneCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resposta, setResposta] = useState("");
  const total = queue.length + doneCount;
  const current = queue[0];

  const today = day(new Date().toISOString());
  const old = useMemo(() => queue.filter((i) => (i.source ?? "gmail") === "gmail" && day(i.date) < today), [queue, today]);

  const markDone = useCallback(async (ids: string[], source: "gmail" | "youtube" = "gmail") => {
    setBusy(true);
    const res = await fetch("/api/feito", { method: "POST", body: JSON.stringify({ ids, source }) });
    setBusy(false);
    if (res.ok) {
      setQueue((q) => q.filter((i) => !ids.includes(i.id)));
      setDoneCount((n) => n + ids.length);
      setResposta("");
      return;
    }
    const detail = await res.json().catch(() => ({}));
    if (res.status === 401) return alert("Sua sessão expirou. Recarregue a página e entre de novo.");
    alert(`Não consegui marcar como feito.\n\nDetalhe: ${detail.error || res.status}`);
  }, []);

  async function enviarResposta() {
    if (!current || !resposta.trim()) return;
    setBusy(true);
    const res = await fetch("/api/youtube", { method: "POST", body: JSON.stringify({ id: current.id, texto: resposta }) });
    setBusy(false);
    if (res.ok) {
      setQueue((q) => q.filter((i) => i.id !== current.id));
      setDoneCount((n) => n + 1);
      setResposta("");
      return;
    }
    const d = await res.json().catch(() => ({}));
    alert(d.error === "permissao"
      ? "Falta a permissão do YouTube. Saia e entre de novo na Central."
      : `Não consegui responder.\n\nDetalhe: ${d.error || res.status}`);
  }

  const skip = useCallback(() => { setResposta(""); setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q)); }, []);

  // Atalhos: F = feito, → = pular, Enter = ação principal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || busy || e.metaKey || e.ctrlKey) return;
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "f" || e.key === "F") markDone([current.id], current.source ?? "gmail");
      else if (e.key === "ArrowRight") skip();
      else if (e.key === "Enter" && current.actionUrl) window.open(current.actionUrl, "_blank");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, busy, markDone, skip]);

  if (!current) {
    return (
      <section className="calm">
        <div className="breath" />
        <h1>{doneCount > 0 ? "Fila zerada." : "Nada precisa de você agora."}</h1>
        <p className="lead">
          {doneCount > 0 ? `${doneCount} resolvid${doneCount === 1 ? "a" : "as"}. ` : ""}
          Próxima janela <span className="next">{nextLabel}</span>. Pode fechar esta aba.
        </p>
      </section>
    );
  }

  const n = queue.length;
  return (
    <section>
      <h1>
        {n} {n === 1 ? "decisão" : "decisões"}
        {mode === "urgent" && <em> urgentes</em>}.
      </h1>
      <p className="lead">
        {mode === "urgent"
          ? `Só o que não pode esperar. O resto fica para a janela ${nextLabel}.`
          : "Uma de cada vez. Resolva, marque como feito, siga."}
      </p>

      {total > 1 && total <= 40 && (
        <div className="progress">
          {Array.from({ length: total }).map((_, i) => <span key={i} className={i < doneCount ? "on" : ""} />)}
        </div>
      )}

      <article key={current.id} className={`focus ${current.urgent ? "urgent" : ""}`}>
        <div className="kicker">
          <span className={`tag ${current.urgent ? "urgent" : current.kind === "youtube" ? "yt" : ""}`}>{LABEL[current.kind]}</span>
          <span>{current.who}</span>
          <span>·</span>
          <span>{when(current.date)}</span>
        </div>
        <div className="title">{current.title}</div>
        {current.preview && <div className="preview">{current.preview}</div>}
        {current.reply && (
          <div className="reply">
            <textarea
              placeholder="Responder como o canal…" rows={3} value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) enviarResposta(); }}
            />
            <button className="btn primary" disabled={busy || !resposta.trim()} onClick={enviarResposta}>
              {busy ? "Enviando…" : "Responder"} <kbd>⌘↵</kbd>
            </button>
          </div>
        )}
        <div className="actions">
          {current.actionUrl && (
            <a className={`btn ${current.reply ? "" : "primary"}`} href={current.actionUrl} target="_blank" rel="noreferrer">
              {current.actionLabel} <kbd>↵</kbd>
            </a>
          )}
          {current.extraUrl && (
            <a className="btn" href={current.extraUrl} target="_blank" rel="noreferrer">{current.extraLabel}</a>
          )}
          {current.gmailUrl && <a className="btn" href={current.gmailUrl} target="_blank" rel="noreferrer">Ver email</a>}
          <button className="btn done" disabled={busy} onClick={() => markDone([current.id], current.source ?? "gmail")}>
            {busy ? "…" : <>{current.reply ? "Ignorar" : "Feito"} <kbd>F</kbd></>}
          </button>
        </div>
      </article>

      <div className="queue-foot">
        {n > 1 ? <button className="linkish" onClick={skip}>Pular por agora →</button> : <span />}
        {old.length >= 5 && (
          <button className="linkish" disabled={busy} onClick={() => confirm(`Marcar ${old.length} itens de dias anteriores como feitos?`) && markDone(old.map((i) => i.id))}>
            Já resolvi os {old.length} de dias anteriores
          </button>
        )}
      </div>
    </section>
  );
}
