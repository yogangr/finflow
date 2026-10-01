import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
const deny = () => NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
const TYPES = ["income", "expense", "savings_in", "savings_out"];

async function getH() {
  if (!(await isAuthed())) return deny();
  const sql = await db();
  const rows = await sql`SELECT id, type, amount::float8 AS amount, category, note,
    CASE WHEN type = 'savings_out' THEN 'BNI' ELSE COALESCE(account, 'BRI') END AS account,
    to_char(date, 'YYYY-MM-DD') AS date FROM transactions ORDER BY date DESC, created_at DESC`;
  return NextResponse.json(rows);
}

async function postH(req) {
  if (!(await isAuthed())) return deny();
  const b = await req.json();
  const amount = Math.round(Number(b.amount));
  const account = b.type === "savings_out" ? "BNI" : b.account;
  const okAccount = b.type === "savings_out" || ["BRI", "SPAY"].includes(account);
  if (!TYPES.includes(b.type) || !okAccount || !(amount > 0) || !b.category || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) {
    return NextResponse.json({ error: "Data belum lengkap. Isi rekening, nominal, kategori, dan tanggal." }, { status: 400 });
  }
  const sql = await db();
  if (b.type === "savings_out") {
    const [r] = await sql`SELECT COALESCE(SUM(CASE WHEN type = 'savings_in' THEN amount ELSE -amount END), 0)::float8 AS bal
      FROM transactions WHERE type IN ('savings_in', 'savings_out')`;
    if (amount > r.bal) return NextResponse.json({ error: "Sisa tabungan BNI tidak cukup." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  await sql`INSERT INTO transactions (id, type, amount, category, note, date, account)
    VALUES (${id}, ${b.type}, ${amount}, ${b.category}, ${(b.note || "").slice(0, 80)}, ${b.date}, ${account})`;
  return NextResponse.json({ id }, { status: 201 });
}

async function delH(req) {
  if (!(await isAuthed())) return deny();
  const id = new URL(req.url).searchParams.get("id");
  const sql = await db();
  await sql`DELETE FROM transactions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

const safe = (fn) => async (req) => {
  try { return await fn(req); }
  catch (e) { console.error(e); return NextResponse.json({ error: "Database: " + (e.message || "gagal") }, { status: 500 }); }
};
export const GET = safe(getH);
export const POST = safe(postH);
export const DELETE = safe(delH);