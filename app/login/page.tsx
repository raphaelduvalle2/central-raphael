"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const error = useSearchParams().get("error");
  return (
    <main className="login">
      <div>
        <div className="breath" />
        <h1>Central</h1>
        <p className="lead" style={{ margin: "0 auto 32px" }}>Só o que precisa de você.</p>
        {error && <p className="meta">Esta conta não tem acesso.</p>}
        <button className="btn primary" onClick={() => signIn("google", { callbackUrl: "/" })}>Entrar com Google</button>
      </div>
    </main>
  );
}

export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
