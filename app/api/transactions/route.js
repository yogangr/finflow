import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
const deny = () => NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
const TYPES = ["income", "expense", "savings_in", "savings_out"];
const NAMES = { BRI: "BRI", SPAY: "ShopeePay" };
const rupiah = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.max(n, 0));
const fail = (msg) => NextResponse.json({ error: msg }, { status: 400 });

async function balance(sql, account) {
  const [r] = await sql`SELECT COALESCE(SUM(CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount WHEN 'savings_in' THEN -amount ELSE 0 END), 0)::float8 AS bal
    FROM transactions WHERE type <> 'savings_out' AND COALESCE(account, 'BRI') = ${account}`;
  return r.bal;
}
async function savings(sql) {
  const [r] = await sql`SELECT COALESCE(SUM(CASE WHEN type = 'savings_in' THEN amount ELSE -amount END), 0)::float8 AS bal
    FROM transactions WHERE type IN ('savings_in', 'savings_out')`;
  return r.bal;
}

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
  if (b.type === "expense" || b.type === "savings_in") {
    const bal = await balance(sql, account);
    if (amount > bal) return fail(`Saldo ${NAMES[account]} tidak cukup. Sisa ${rupiah(bal)}.`);
  }
  if (b.type === "savings_out") {
    const bal = await savings(sql);
    if (amount > bal) return fail(`Sisa tabungan BNI tidak cukup. Sisa ${rupiah(bal)}.`);
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
  const [row] = await sql`SELECT type, amount::float8 AS amount, COALESCE(account, 'BRI') AS account FROM transactions WHERE id = ${id}`;
  if (row?.type === "income" && (await balance(sql, row.account)) - row.amount < 0)
    return fail("Tidak bisa dihapus: saldo rekening akan menjadi minus.");
  if (row?.type === "savings_in" && (await savings(sql)) - row.amount < 0)
    return fail("Tidak bisa dihapus: tabungan BNI akan menjadi minus (sebagian sudah terpakai).");
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
