import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { lerSaldos, DriveScopeError } from "@/lib/drive";
import { salesSince } from "@/lib/briefing";
import Form from "./Form";
import Reentrar from "../Reentrar";

export const dynamic = "force-dynamic";

export default async function SaldosPage() {
  const session = await requireSession();
  if (!session || session.error) redirect("/login");
  try {
    const saldos = await lerSaldos(session.accessToken);
    // O Pagar.me já vem com as vendas desde a última atualização somadas.
    const vendas = saldos.atualizadoEm ? await salesSince(session.accessToken, saldos.atualizadoEm) : [];
    const extra = Math.round(vendas.reduce((t, v) => t + v.net, 0) * 100) / 100;
    return (
      <main className="wrap">
        <div className="top">
          <a className="brand" href="/?agora=1" style={{ textDecoration: "none" }}><i />Qualidade de Vida</a>
          <span className="top-right"><span className="pill">saldos de hoje</span><Reentrar compact /></span>
        </div>
        <h1>Saldos <em>de hoje.</em></h1>
        <p className="lead">Confira os bancos e, se sacou do Pagar.me, informe o saque. O resto já vem preenchido.</p>
        <Form inicial={saldos} vendas={{ count: vendas.length, net: extra }} />
      </main>
    );
  } catch (e) {
    if (e instanceof DriveScopeError) {
      return (
        <main className="wrap">
          <div className="top"><span className="brand"><i />Qualidade de Vida</span></div>
          <h1>Falta <em>uma permissão.</em></h1>
          <p className="lead">
            Os saldos ficam numa pasta privada do app no seu Google Drive, invisível entre os seus arquivos. Entre de novo e marque a nova permissão.
          </p>
          <Reentrar primary />
        </main>
      );
    }
    throw e;
  }
}
