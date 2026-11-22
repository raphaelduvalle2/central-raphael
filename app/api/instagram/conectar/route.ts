import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireSession } from "@/lib/auth";
import { urlDeAutorizacao } from "@/lib/instagram";

export async function GET() {
  const session = await requireSession();
  if (!session) return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/login`);
  if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/?agora=1&ig=sem-config`);
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(urlDeAutorizacao(state));
  res.cookies.set("ig_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
