import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { contaInstagram, responderInstagram } from "@/lib/instagram";
import { marcarFeitosYT } from "@/lib/drive";

// Responde comentário ou DM como a sua conta e tira da fila.
export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const { id, texto, meta } = await req.json();
  if (typeof id !== "string" || typeof texto !== "string" || !texto.trim() || texto.length > 2000)
    return NextResponse.json({ error: "resposta inválida" }, { status: 400 });
  const conta = await contaInstagram(session.accessToken);
  if (!conta) return NextResponse.json({ error: "Instagram desconectado. Conecte de novo na janela." }, { status: 400 });
  try {
    await responderInstagram(conta, id, texto.trim(), { tipo: String(meta?.tipo || "comentario"), para: meta?.para });
    await marcarFeitosYT(session.accessToken, [id]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message).slice(0, 300) }, { status: 500 });
  }
}
