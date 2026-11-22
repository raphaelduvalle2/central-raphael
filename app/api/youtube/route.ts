import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { responder, YouTubeScopeError } from "@/lib/youtube";
import { marcarFeitosYT } from "@/lib/drive";

// Responde a um comentário como o canal e tira da fila.
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const { id, texto } = await req.json();
  if (typeof id !== "string" || typeof texto !== "string" || !texto.trim() || texto.length > 5000)
    return NextResponse.json({ error: "resposta inválida" }, { status: 400 });
  try {
    await responder(session.accessToken, id, texto.trim());
    await marcarFeitosYT(session.accessToken, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const scope = e instanceof YouTubeScopeError;
    return NextResponse.json({ error: scope ? "permissao" : String(e?.message).slice(0, 300) }, { status: scope ? 403 : 500 });
  }
}
