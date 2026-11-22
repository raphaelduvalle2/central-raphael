import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { lerSaldos, DriveScopeError } from "@/lib/drive";
import Form from "./Form";

import Reentrar from "../Reentrar";

export const dynamic = "force-dynamic";

export default async function SaldosPage() {
  const session = await requireSession();
  if (!session || session.error) redirect("/login");
  try {
    const saldos = await lerSaldos(session.accessToken);
    return (
      <main className="wrap">
        <div className="top"><a className="brand" href="/?agora=1" style={{ textDecoration: "none" }}><i />Central</a><span className="pill">saldos</span></div>
        <h1>Saldos <em>da semana.</em></h1>
        <p className="lead">Atualize uma vez por semana. Entre uma atualização e outra, o Pagar.me soma sozinho o líquido estimado das vendas.</p>
        <Form inicial={saldos} />
      </main>
    );
  } catch (e) {
    if (e instanceof DriveScopeError) return <PrecisaPermissao />;
    throw e;
  }
}

function PrecisaPermissao() {
  return (
    <main className="wrap">
      <div className="top"><span className="brand"><i />Central</span></div>
      <h1>Falta <em>uma permissão.</em></h1>
      <p className="lead">
        Os saldos ficam guardados numa pasta privada do app no seu Google Drive. Ela fica invisível no seu Drive e só a Central acessa.
        Entre de novo e marque a nova permissão.
      </p>
      <Reentrar primary />
    </main>
  );
}
