import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { conectar } from "@/lib/instagram";

export async function GET(req: NextRequest) {
  const base = process.env.NEXTAUTH_URL;
  const session = await requireSession();
  if (!session) return NextResponse.redirect(`${base}/login`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("ig_state")?.value)
    return NextResponse.redirect(`${base}/?agora=1&ig=erro`);
  try {
    await conectar(session.accessToken, code.replace(/#_$/, ""));
    const res = NextResponse.redirect(`${base}/?agora=1&ig=ok`);
    res.cookies.delete("ig_state");
    return res;
  } catch (e: any) {
    console.error("instagram conectar", e?.message);
    return NextResponse.redirect(`${base}/?agora=1&ig=erro`);
  }
}
