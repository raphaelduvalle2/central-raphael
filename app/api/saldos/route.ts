import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { salvarSaldos, DriveScopeError } from "@/lib/drive";
import { sanitizar } from "@/lib/saldos";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  try {
    await salvarSaldos(session.accessToken, sanitizar(await req.json()));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const scope = e instanceof DriveScopeError;
    return NextResponse.json({ error: scope ? "permissao" : String(e?.message).slice(0, 200) }, { status: scope ? 403 : 500 });
  }
}
