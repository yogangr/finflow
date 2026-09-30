import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
const deny = () => NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });

export async function GET() {
  if (!(await isAuthed())) return deny();
  const sql = await db();
  const rows = await sql`SELECT id, type, amount::float8 AS amount, category, note,
    to_char(date, 'YYYY-MM-DD') AS date FROM transactions ORDER BY date DESC, created_at DESC`;
  return NextResponse.json(rows);
}

export async function POST(req) {
  if (!(await isAuthed())) return deny();
  const b = await req.json();
  const amount = Math.round(Number(b.amount));
  if (!["income", "expense", "savings_in", "savings_out"].includes(b.type) || !(amount > 0) || !b.category || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) {
    return NextResponse.json({ error: "Data belum lengkap. Isi nominal, kategori, dan tanggal." }, { status: 400 });
  }
  const sql = await db();
  if (b.type === "savings_out") {
    const [r] = await sql`SELECT COALESCE(SUM(CASE WHEN type = 'savings_in' THEN amount ELSE -amount END), 0)::float8 AS bal
      FROM transactions WHERE type IN ('savings_in', 'savings_out')`;
    if (amount > r.bal) return NextResponse.json({ error: "Saldo tabungan tidak cukup untuk ditarik." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await sql`INSERT INTO transactions (id, type, amount, category, note, date)
    VALUES (${id}, ${b.type}, ${amount}, ${b.category}, ${(b.note || "").slice(0, 80)}, ${b.date})`;
  return NextResponse.json({ id }, { status: 201 });
}

export async function DELETE(req) {
  if (!(await isAuthed())) return deny();
  const id = new URL(req.url).searchParams.get("id");
  const sql = await db();
  await sql`DELETE FROM transactions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}