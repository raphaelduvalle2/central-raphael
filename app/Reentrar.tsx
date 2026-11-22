"use client";
import { signOut } from "next-auth/react";
export default function Reentrar({ primary, compact }: { primary?: boolean; compact?: boolean }) {
  return (
    <button
      className={compact ? "pill sair" : `btn ${primary ? "primary" : ""}`}
      title="Sair e entrar de novo (renova as permissões do Google)"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {compact ? "Sair / entrar" : "Sair e entrar de novo"}
    </button>
  );
}
