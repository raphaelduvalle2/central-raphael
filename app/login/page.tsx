"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const error = useSearchParams().get("error");
  return (
    <main className="login">
      <div>
        <h1>Central</h1>
        <p className="lead">Acesso pessoal.</p>
        {error && <p className="meta">Esta conta não tem acesso.</p>}
        <button className="btn primary" onClick={() => signIn("google", { callbackUrl: "/" })}>
          Entrar com Google
        </button>
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
