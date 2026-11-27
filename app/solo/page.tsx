import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { lerBanco, salvarBanco, conferirRespostas, importarRadar, importarContatos, followupsDevidos } from "@/lib/duvalle-store";
import Reentrar from "../Reentrar";
import Atualizar from "../Atualizar";
import Solo from "./Solo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duvalle Solo · Qualidade de Vida" };

export default async function SoloPage() {
  const session = await requireSession();
  if (!session || session.error) redirect("/login");
  const b = await lerBanco(session.accessToken);
  const respostas = await conferirRespostas(session.accessToken, b, { sempre: true }).catch(() => false);
  const novos = await importarRadar(session.accessToken, b).catch(() => 0);
  const contatosNovos = await importarContatos(session.accessToken, b).catch(() => 0);
  if (respostas || novos || contatosNovos) await salvarBanco(session.accessToken, b).catch(() => {});
  return (
    <main className="wrap wide">
      <div className="top">
        <a className="brand" href="/?agora=1" style={{ textDecoration: "none" }}><i />Qualidade de Vida</a>
        <span className="top-right"><span className="pill">Duvalle Solo</span><Atualizar /><Reentrar compact /></span>
      </div>
      <Solo inicial={b} followups={followupsDevidos(b).map((c) => c.id)} />
    </main>
  );
}
