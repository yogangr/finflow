import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
const deny = () =>
  NextResponse.json({ error: "Silakan masuk dulu." }, { status: 401 });
const fail = (msg) => NextResponse.json({ error: msg }, { status: 400 });
const TYPES = ["income", "expense", "savings_in", "savings_out", "transfer"];
const NAMES = { BRI: "BRI", SPAY: "ShopeePay", BNI: "tabungan BNI" };
const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.max(n, 0));

function parse(b) {
  const amount = Math.round(Number(b.amount));
  const account = b.type === "savings_out" ? "BNI" : b.account;
  const category = b.type === "transfer" ? "Pindah saldo" : b.category;
  const okAccount =
    b.type === "savings_out" || ["BRI", "SPAY"].includes(account);
  if (
    !TYPES.includes(b.type) ||
    !okAccount ||
    !(amount > 0) ||
    !category ||
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")
  ) {
    return {
      error:
        "Data belum lengkap. Isi rekening, nominal, kategori, dan tanggal.",
    };
  }
  return {
    type: b.type,
    amount,
    account,
    category,
    date: b.date,
    note: (b.note || "").slice(0, 80),
    toAccount:
      b.type === "transfer" ? (account === "BRI" ? "SPAY" : "BRI") : null,
  };
}

// Hitung saldo semua rekening dari daftar transaksi
function calc(rows) {
  const b = { BRI: 0, SPAY: 0, BNI: 0 };
  for (const t of rows) {
    const a = t.account || "BRI",
      n = Number(t.amount);
    if (t.type === "income") b[a] += n;
    else if (t.type === "expense") b[a] -= n;
    else if (t.type === "savings_in") {
      b[a] -= n;
      b.BNI += n;
    } else if (t.type === "savings_out") b.BNI -= n;
    else if (t.type === "transfer") {
      b[a] -= n;
      b[t.to_account] += n;
    }
  }
  return b;
}

async function balance(sql, account) {
  const [r] = await sql`SELECT COALESCE(SUM(CASE
      WHEN type = 'transfer' AND to_account = ${account} THEN amount
      WHEN COALESCE(account, 'BRI') <> ${account} THEN 0
      WHEN type = 'income' THEN amount
      WHEN type IN ('expense', 'savings_in', 'transfer') THEN -amount
      ELSE 0 END), 0)::float8 AS bal FROM transactions`;
  return r.bal;
}
async function savings(sql) {
  const [r] =
    await sql`SELECT COALESCE(SUM(CASE WHEN type = 'savings_in' THEN amount ELSE -amount END), 0)::float8 AS bal
    FROM transactions WHERE type IN ('savings_in', 'savings_out')`;
  return r.bal;
}

async function getH() {
  if (!(await isAuthed())) return deny();
  const sql = await db();
  const rows =
    await sql`SELECT id, type, amount::float8 AS amount, category, note,
    CASE WHEN type = 'savings_out' THEN 'BNI' ELSE COALESCE(account, 'BRI') END AS account, to_account,
    to_char(date, 'YYYY-MM-DD') AS date FROM transactions ORDER BY date DESC, created_at DESC`;
  return NextResponse.json(rows);
}

async function postH(req) {
  if (!(await isAuthed())) return deny();
  const p = parse(await req.json());
  if (p.error) return fail(p.error);
  const sql = await db();
  if (["expense", "savings_in", "transfer"].includes(p.type)) {
    const bal = await balance(sql, p.account);
    if (p.amount > bal)
      return fail(
        `Saldo ${NAMES[p.account]} tidak cukup. Sisa ${rupiah(bal)}.`,
      );
  }
  if (p.type === "savings_out") {
    const bal = await savings(sql);
    if (p.amount > bal)
      return fail(`Sisa tabungan BNI tidak cukup. Sisa ${rupiah(bal)}.`);
  }
  const id = crypto.randomUUID();
  await sql`INSERT INTO transactions (id, type, amount, category, note, date, account, to_account)
    VALUES (${id}, ${p.type}, ${p.amount}, ${p.category}, ${p.note}, ${p.date}, ${p.account}, ${p.toAccount})`;
  return NextResponse.json({ id }, { status: 201 });
}

async function putH(req) {
  if (!(await isAuthed())) return deny();
  const b = await req.json();
  const p = parse(b);
  if (p.error) return fail(p.error);
  const sql = await db();
  const rows =
    await sql`SELECT id, type, amount::float8 AS amount, account, to_account FROM transactions`;
  if (!rows.some((r) => r.id === b.id))
    return fail("Transaksi tidak ditemukan.");

  // Tolak hanya jika perubahan membuat saldo (lebih) minus dari sebelumnya
  const before = calc(rows);
  const after = calc(
    rows.map((r) =>
      r.id === b.id
        ? {
            id: r.id,
            type: p.type,
            amount: p.amount,
            account: p.account,
            to_account: p.toAccount,
          }
        : r,
    ),
  );
  for (const k of ["BRI", "SPAY", "BNI"]) {
    if (after[k] < 0 && after[k] < before[k])
      return fail(
        `Perubahan ditolak: saldo ${NAMES[k]} akan minus ${rupiah(-after[k])}.`,
      );
  }
  await sql`UPDATE transactions SET type = ${p.type}, amount = ${p.amount}, category = ${p.category}, note = ${p.note},
    date = ${p.date}, account = ${p.account}, to_account = ${p.toAccount} WHERE id = ${b.id}`;
  return NextResponse.json({ ok: true });
}

async function delH(req) {
  if (!(await isAuthed())) return deny();
  const id = new URL(req.url).searchParams.get("id");
  const sql = await db();
  const [row] =
    await sql`SELECT type, amount::float8 AS amount, COALESCE(account, 'BRI') AS account, to_account FROM transactions WHERE id = ${id}`;
  if (
    row?.type === "income" &&
    (await balance(sql, row.account)) - row.amount < 0
  )
    return fail("Tidak bisa dihapus: saldo rekening akan menjadi minus.");
  if (row?.type === "savings_in" && (await savings(sql)) - row.amount < 0)
    return fail(
      "Tidak bisa dihapus: tabungan BNI akan menjadi minus (sebagian sudah terpakai).",
    );
  if (
    row?.type === "transfer" &&
    (await balance(sql, row.to_account)) - row.amount < 0
  )
    return fail(
      "Tidak bisa dihapus: saldo tujuan sudah terpakai dan akan menjadi minus.",
    );
  await sql`DELETE FROM transactions WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

const safe = (fn) => async (req) => {
  try {
    return await fn(req);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Database: " + (e.message || "gagal") },
      { status: 500 },
    );
  }
};
export const GET = safe(getH);
export const POST = safe(postH);
export const PUT = safe(putH);
export const DELETE = safe(delH);
