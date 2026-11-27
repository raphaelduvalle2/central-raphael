"use client";
import { useEffect, useRef, useState } from "react";

/** Botão de atualizar (o app instalado não tem o "recarregar" do navegador).
 *  Também atualiza sozinho ao voltar para o app depois de 10+ minutos fora. */
export default function Atualizar() {
  const [pending, setPending] = useState(false);
  const saiu = useRef<number | null>(null);
  const recarregar = () => { setPending(true); window.location.reload(); };

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) { saiu.current = Date.now(); return; }
      if (saiu.current && Date.now() - saiu.current > 10 * 60_000) recarregar();
      saiu.current = null;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <button className="pill sair atualizar" title="Atualizar agora (⌘R)" disabled={pending} onClick={recarregar}>
      <span className={pending ? "gira" : ""}>↻</span>{pending ? " atualizando…" : " Atualizar"}
    </button>
  );
}
