"use client";
import { useEffect, useState } from "react";
import { windowState } from "@/lib/windows";

const FLAG = "qv-janela-abriu";

/** Mantém a tela em dia com as janelas de decisão:
 *  - quando uma janela abre ou fecha, a página se atualiza sozinha;
 *  - ao abrir, avisa com uma notificação do sistema e um número no ícone do app (se permitido). */
export default function Relogio({ aberta, total }: { aberta: boolean; total: number }) {
  const [perm, setPerm] = useState<NotificationPermission | "na">("na");

  useEffect(() => {
    if ("Notification" in window) setPerm(Notification.permission);

    // Chegou aqui porque a janela acabou de abrir? Avisa.
    if (aberta && sessionStorage.getItem(FLAG)) {
      sessionStorage.removeItem(FLAG);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Janela de decisões aberta", {
            body: total ? `${total} ${total === 1 ? "decisão" : "decisões"} esperando por você. 30 minutos.` : "Nada pendente. Aproveite.",
            icon: "/icon.png",
          });
        } catch {}
      }
    }

    // Número no ícone do app (Dock / tela inicial).
    const nav = navigator as any;
    try {
      if (aberta && total) nav.setAppBadge?.(total);
      else nav.clearAppBadge?.();
    } catch {}

    // Confere a cada 20s se a janela mudou de estado; se mudou, atualiza.
    const t = setInterval(() => {
      const agora = windowState().open;
      if (agora !== aberta) {
        if (agora) sessionStorage.setItem(FLAG, "1");
        window.location.reload();
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [aberta, total]);

  if (perm !== "default") return null;
  return (
    <p className="quiet">
      <button className="linkbtn" onClick={async () => setPerm(await Notification.requestPermission())}>
        Ativar aviso quando a janela abrir
      </button>
    </p>
  );
}
