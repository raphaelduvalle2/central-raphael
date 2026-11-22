"use client";
import { signOut } from "next-auth/react";
export default function Reentrar({ primary }: { primary?: boolean }) {
  return (
    <button className={`btn ${primary ? "primary" : ""}`} onClick={() => signOut({ callbackUrl: "/login" })}>
      Sair e entrar de novo
    </button>
  );
}
