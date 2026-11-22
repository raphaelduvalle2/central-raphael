import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { markDone } from "@/lib/gmail";
import { marcarFeitosYT } from "@/lib/drive";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const { ids, source = "gmail" } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((x) => typeof x === "string"))
    return NextResponse.json({ error: "ids inválidos" }, { status: 400 });
  try {
    if (source === "youtube" || source === "instagram") await marcarFeitosYT(session.accessToken, ids);
    else await markDone(session.accessToken, ids);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("feito falhou", e?.message);
    return NextResponse.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
}
