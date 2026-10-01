"use client";
import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const rp = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : n);
const COLORS = ["#4f46e5", "#14b8a6", "#f43f5e", "#f59e0b", "#8b5cf6", "#0ea5e9", "#64748b"];
const SAV = ["Umum", "Dana darurat", "Liburan", "Pendidikan", "Investasi"];
const CATS = {
  expense: ["Makanan", "Transport", "Belanja", "Tagihan", "Hiburan", "Kesehatan"],
  income: ["Gaji", "Freelance", "Investasi", "Lainnya"],
  savings_in: SAV,
  savings_out: SAV,
};
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const NAME = { BRI: "BRI", SPAY: "ShopeePay", BNI: "BNI" };
const QUICK = [
  { type: "income", label: "Pemasukan", icon: "+", cls: "bg-teal-50 text-teal-700" },
  { type: "expense", label: "Pengeluaran", icon: "−", cls: "bg-rose-50 text-rose-600" },
  { type: "savings_in", label: "Nabung", icon: "↓", cls: "bg-indigo-50 text-indigo-700" },
  { type: "savings_out", label: "Pakai tabungan", icon: "↑", cls: "bg-amber-50 text-amber-700" },
];
const LABEL = Object.fromEntries(QUICK.map((q) => [q.type, q.label]));
const isSav = (t) => t.type.startsWith("savings");
const plus = (t) => t.type === "income" || t.type === "savings_in";
const tone = (t) => (isSav(t) ? "indigo" : plus(t) ? "teal" : "rose");
const ICON = { indigo: "bg-indigo-50 text-indigo-600", teal: "bg-teal-50 text-teal-600", rose: "bg-rose-50 text-rose-500" };
const TEXT = { indigo: "text-indigo-600", teal: "text-teal-600", rose: "text-rose-500" };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const blank = () => ({ type: "expense", account: "BRI", amount: "", category: "Makanan", note: "", date: ymd(new Date()) });

export default function Dashboard() {
  const now = new Date();
  const thisYear = now.getFullYear();
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("list");
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(15);
  const [year, setYear] = useState(thisYear);
  const [authed, setAuthed] = useState(true);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loadErr, setLoadErr] = useState("");

  const load = async () => {
    try {
      const res = await fetch("/api/transactions");
      if (res.status === 401) { setAuthed(false); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server bermasalah");
      setAuthed(true);
      setLoadErr("");
      setTx(data);
    } catch (e) {
      setLoadErr(e.message || "Tidak bisa terhubung ke server");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const openForm = (type = "expense") => {
    setForm({ ...blank(), type, category: CATS[type][0], account: type === "savings_out" ? "BNI" : "BRI" });
    setError("");
    setOpen(true);
  };
  const setType = (t) => setForm({ ...form, type: t, category: CATS[t][0], account: t === "savings_out" ? "BNI" : form.account === "BNI" ? "BRI" : form.account });
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Gagal menyimpan. Coba lagi.");
    setOpen(false);
    load();
  };
  const remove = async (id) => { if (confirm("Hapus transaksi ini?")) { await fetch(`/api/transactions?id=${id}`, { method: "DELETE" }); load(); } };
  const login = async (e) => {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (!res.ok) return setLoginErr("Password salah. Coba lagi.");
    setPw("");
    load();
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); setTx([]); setAuthed(false); };

  const years = useMemo(() => [...new Set([thisYear, ...tx.map((t) => +t.date.slice(0, 4))])].sort((a, b) => b - a), [tx, thisYear]);

  const stats = useMemo(() => {
    const by = (f) => tx.filter(f).reduce((s, t) => s + t.amount, 0);
    const ty = (type, a) => by((t) => t.type === type && (!a || t.account === a));
    const nabung = ty("savings_in"), tarik = ty("savings_out");
    const acc = (a) => ty("income", a) - ty("expense", a) - ty("savings_in", a);
    const BRI = acc("BRI"), SPAY = acc("SPAY");

    const sum = (r, type) => r.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
    const mk = (r) => { const i = sum(r, "income"), e = sum(r, "expense"), n = sum(r, "savings_in"); return { Pemasukan: i, Pengeluaran: e, nabung: n, tarik: sum(r, "savings_out"), sisa: i - e - n }; };
    const last = year === thisYear ? now.getMonth() : 11;
    const rows = Array.from({ length: last + 1 }, (_, m) => ({ name: MONTHS[m], short: MONTHS[m].slice(0, 3), ...mk(tx.filter((t) => t.date.startsWith(`${year}-${String(m + 1).padStart(2, "0")}`))) }));
    const total = rows.reduce((s, r) => Object.fromEntries(Object.keys(s).map((k) => [k, s[k] + r[k]])), { Pemasukan: 0, Pengeluaran: 0, nabung: 0, tarik: 0, sisa: 0 });
    const cur = mk(tx.filter((t) => t.date.startsWith(ymd(now).slice(0, 7))));

    const byCat = {};
    tx.filter((t) => t.type === "expense").forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.amount));
    const cats = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { nabung, tarik, BRI, SPAY, sisa: BRI + SPAY, tabungan: nabung - tarik, rows, total, cur, cats };
  }, [tx, year, thisYear]);

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <form onSubmit={login} className="panel w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-extrabold tracking-tight">FinFlow</h1>
          <p className="text-sm text-slate-500">Masukkan password untuk membuka dasbor keuanganmu.</p>
          <input className="field" type="password" placeholder="Password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
          {loginErr && <p className="text-sm text-rose-600" role="alert">{loginErr}</p>}
          <button className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-700">Masuk</button>
        </form>
      </main>
    );
  }

  const v = (n) => (loading ? "…" : rp(n));
  const list = tx.filter((t) => filter === "all" || (filter === "savings" ? isSav(t) : t.type === filter));
  const FILTERS = [["all", "Semua"], ["income", "Pemasukan"], ["expense", "Pengeluaran"], ["savings", "Tabungan"]];

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-6 sm:space-y-5 sm:px-6 sm:py-8 lg:pb-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">FinFlow</h1>
          <p className="text-sm text-slate-500">Catatan keuangan pribadimu.</p>
        </div>
        <button onClick={logout} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50">Keluar</button>
      </header>

      {loadErr && (
        <div role="alert" className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">
          Gagal memuat data: {loadErr}
          <button onClick={load} className="ml-2 font-semibold underline">Coba lagi</button>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="hero relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-5 text-white sm:p-8 lg:col-span-3">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/30 blur-3xl" />
          <p className="text-indigo-100">Uang yang bisa dipakai</p>
          <p className="mt-1 break-words text-3xl font-extrabold tracking-tight sm:text-5xl">{v(stats.sisa)}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[["BRI", stats.BRI], ["ShopeePay", stats.SPAY]].map(([l, n]) => (
              <div key={l} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                <p className="text-xs text-indigo-100">{l}</p>
                <p className="mt-0.5 break-words text-[15px] font-bold sm:text-lg">{v(n)}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-amber-100 p-5 text-amber-950 sm:p-8 lg:col-span-2">
          <p className="font-medium text-amber-800">Tabungan BNI</p>
          <p className="mt-1 break-words text-3xl font-extrabold tracking-tight sm:text-4xl">{v(stats.tabungan)}</p>
          <p className="mt-4 text-sm text-amber-900/80">Total nabung {v(stats.nabung)}<br />Sudah terpakai {v(stats.tarik)}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK.map((q) => (
          <button key={q.type} onClick={() => openForm(q.type)} className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition active:scale-[.98] sm:text-base ${q.cls}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-lg font-bold">{q.icon}</span>{q.label}
          </button>
        ))}
      </section>

      <section className="panel">
        <h2 className="font-bold">Ringkasan {MONTHS[now.getMonth()]}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["Masuk", stats.cur.Pemasukan, "text-teal-600"], ["Keluar", stats.cur.Pengeluaran, "text-rose-500"], ["Nabung", stats.cur.nabung, "text-indigo-600"]].map(([l, n, c]) => (
            <div key={l} className="rounded-2xl bg-slate-50 px-1 py-3">
              <p className="text-xs text-slate-500">{l}</p>
              <p className={`mt-0.5 break-words text-sm font-bold sm:text-lg ${c}`}>{v(n)}</p>
            </div>
          ))}
        </div>
      </section>

      <div role="tablist" className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {[["list", "Transaksi"], ["month", "Per bulan"], ["chart", "Grafik"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${tab === k ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>{l}</button>
        ))}
      </div>

      {tab === "list" && (
        <section className="panel">
          <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-2">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => { setFilter(k); setLimit(15); }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${filter === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
            ))}
          </div>
          {list.length === 0 && <p className="py-8 text-center text-slate-500">Belum ada transaksi. Tekan salah satu tombol di atas untuk mencatat.</p>}
          <ul className="divide-y divide-slate-100">
            {list.slice(0, limit).map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 py-3 sm:gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold ${ICON[tone(t)]}`}>{plus(t) ? "+" : "−"}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.note || t.category}</p>
                  <p className="text-xs text-slate-500">{t.type === "savings_in" ? `${NAME[t.account]} → BNI` : NAME[t.account]} • {t.category} • {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <p className={`whitespace-nowrap text-sm font-bold sm:text-base ${TEXT[tone(t)]}`}>{plus(t) ? "+" : "−"}{rp(t.amount)}</p>
                <button onClick={() => remove(t.id)} aria-label="Hapus transaksi" className="-mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500">✕</button>
              </li>
            ))}
          </ul>
          {list.length > limit && <button onClick={() => setLimit(limit + 15)} className="mt-3 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold">Tampilkan lebih banyak</button>}
        </section>
      )}

      {tab === "month" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Rekap per bulan</h2>
            <select className="field !w-auto !py-1.5" aria-label="Tahun" value={year} onChange={(e) => setYear(+e.target.value)}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{ name: `Total ${year}`, ...stats.total, hl: true }, ...[...stats.rows].reverse()].map((r) => (
              <div key={r.name} className={`rounded-2xl p-4 ${r.hl ? "bg-indigo-50 ring-1 ring-indigo-200 sm:col-span-2" : "bg-white shadow-sm"}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold">{r.name}</h3>
                  <p className={`font-bold ${r.sisa < 0 ? "text-rose-600" : "text-teal-600"}`}>{rp(r.sisa)}</p>
                </div>
                <p className="text-right text-xs text-slate-500">Sisa saldo (masuk − keluar − nabung)</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
                  {[["Pemasukan", r.Pemasukan], ["Pengeluaran", r.Pengeluaran], ["Nabung", r.nabung], ["Pakai tabungan", r.tarik]].map(([k, n]) => (
                    <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="font-semibold">{rp(n)}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "chart" && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="panel lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="font-bold">Arus kas {year}</h2><p className="text-sm text-slate-500">Pemasukan dan pengeluaran tiap bulan.</p></div>
              <select className="field !w-auto !py-1.5" aria-label="Tahun" value={year} onChange={(e) => setYear(+e.target.value)}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer>
                <AreaChart data={stats.rows} margin={{ left: -8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9f4" />
                  <XAxis dataKey="short" axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={short} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(x) => rp(x)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(22,25,58,.15)" }} />
                  <Area type="monotone" dataKey="Pemasukan" stroke="#14b8a6" strokeWidth={3} fill="url(#gi)" />
                  <Area type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={3} fill="url(#ge)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel">
            <h2 className="font-bold">Pengeluaran per kategori</h2>
            <div className="h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={stats.cats} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} strokeWidth={0}>
                    {stats.cats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(x) => rp(x)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {stats.cats.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span>
                  <span className="font-semibold">{short(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <button onClick={() => openForm("expense")} style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/30 transition active:scale-95 lg:hidden">+ Tambah transaksi</button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={() => setOpen(false)}>
          <form role="dialog" aria-modal="true" aria-label="Tambah transaksi" onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Tambah transaksi</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {QUICK.map((q) => (
                <button type="button" key={q.type} onClick={() => setType(q.type)}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition ${form.type === q.type ? "bg-white shadow" : "text-slate-500"}`}>{q.label}</button>
              ))}
            </div>
            <input className="field !text-2xl font-bold" type="number" inputMode="numeric" min="1" autoFocus placeholder="Nominal (Rp)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            {form.type === "savings_out" ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Dibayar dari tabungan BNI. Sisa saat ini {rp(stats.tabungan)}.</p>
            ) : (
              <select className="field" aria-label="Rekening" value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
                {["BRI", "SPAY"].map((a) => <option key={a} value={a}>{form.type === "savings_in" ? "Dari " : "Rekening "}{NAME[a]}</option>)}
              </select>
            )}
            <select className="field" aria-label="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATS[form.type].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="field" placeholder="Catatan (opsional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <input className="field" type="date" aria-label="Tanggal" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
            <button className="w-full rounded-xl bg-indigo-600 py-3.5 font-semibold text-white transition hover:bg-indigo-700">Simpan</button>
          </form>
        </div>
      )}
    </main>
  );
}