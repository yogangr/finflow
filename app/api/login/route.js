import { NextResponse } from "next/server";
import { createSession, passwordOk } from "@/lib/auth";

export async function POST(req) {
  const { password } = await req.json();
  if (!passwordOk(password)) return NextResponse.json({ error: "Password salah." }, { status: 401 });
  await createSession();
  return NextResponse.json({ ok: true });
}
