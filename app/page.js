"use client";
import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from "recharts";

const rp = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")} jt` : n >= 1e3 ? `${Math.round(n / 1e3)} rb` : n);
const COLORS = ["#4f46e5", "#14b8a6", "#f43f5e", "#f59e0b", "#8b5cf6", "#0ea5e9", "#64748b"];
const CATS = {
  expense: ["Makanan", "Transport", "Belanja", "Tagihan", "Hiburan", "Kesehatan"],
  income: ["Gaji", "Freelance", "Investasi", "Lainnya"],
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ type: "expense", amount: "", category: "Makanan", note: "", date: today() });

export default function Dashboard() {
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank());
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [authed, setAuthed] = useState(true);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");

  const load = async () => {
    const res = await fetch("/api/transactions");
    if (res.status === 401) { setAuthed(false); setLoading(false); return; }
    setAuthed(true);
    setTx(await res.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) return setError((await res.json()).error);
    setForm(blank());
    load();
  };
  const remove = async (id) => { await fetch(`/api/transactions?id=${id}`, { method: "DELETE" }); load(); };

  const stats = useMemo(() => {
    const sum = (rows, type) => rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
    const income = sum(tx, "income");
    const expense = sum(tx, "expense");

    const now = new Date();
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rows = tx.filter((t) => t.date.startsWith(key));
      return { name: MONTHS[d.getMonth()], Pemasukan: sum(rows, "income"), Pengeluaran: sum(rows, "expense") };
    });

    const byCat = {};
    tx.filter((t) => t.type === "expense").forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.amount));
    const cats = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { income, expense, balance: income - expense, rate: income ? Math.round(((income - expense) / income) * 100) : 0, monthly, cats };
  }, [tx]);

  const list = tx.filter((t) => filter === "all" || t.type === filter).slice(0, 12);
  const cur = stats.monthly[stats.monthly.length - 1];

  const login = async (e) => {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (!res.ok) return setLoginErr("Password salah. Coba lagi.");
    setPw("");
    load();
  };
  const logout = async () => { await fetch("/api/logout", { method: "POST" }); setTx([]); setAuthed(false); };

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

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">FinFlow</h1>
          <p className="text-sm text-slate-500">Catatan keuangan pribadimu, semua di satu tempat.</p>
        </div>
        <button onClick={logout} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50">Keluar</button>
      </header>

      <section className="hero relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-7 text-white sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-teal-400/30 blur-3xl" />
        <p className="text-indigo-100">Total saldo</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight sm:text-6xl">{loading ? "…" : rp(stats.balance)}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Mini label="Total pemasukan" value={rp(stats.income)} />
          <Mini label="Total pengeluaran" value={rp(stats.expense)} />
          <Mini label="Rasio tabungan" value={`${stats.rate}%`} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <h2 className="font-bold">Arus kas 6 bulan terakhir</h2>
          <p className="mb-4 text-sm text-slate-500">Bandingkan pemasukan dan pengeluaran tiap bulan.</p>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={stats.monthly}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.35} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6e9f4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={short} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v) => rp(v)} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 8px 24px rgba(22,25,58,.15)" }} />
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
                <Tooltip formatter={(v) => rp(v)} />
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

      <section className="panel">
        <h2 className="font-bold">Perbandingan bulanan</h2>
        <p className="mb-4 text-sm text-slate-500">Bulan ini: pemasukan {rp(cur.Pemasukan)}, pengeluaran {rp(cur.Pengeluaran)}.</p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={stats.monthly} barGap={6}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis tickFormatter={short} axisLine={false} tickLine={false} width={55} />
              <Tooltip formatter={(v) => rp(v)} cursor={{ fill: "#eef1f8" }} />
              <Bar dataKey="Pemasukan" fill="#14b8a6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Pengeluaran" fill="#f43f5e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={submit} className="panel space-y-3 lg:col-span-2">
          <h2 className="font-bold">Tambah transaksi</h2>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {["expense", "income"].map((t) => (
              <button type="button" key={t} onClick={() => setForm({ ...form, type: t, category: CATS[t][0] })}
                className={`rounded-lg py-2 text-sm font-semibold transition ${form.type === t ? "bg-white shadow" : "text-slate-500"}`}>
                {t === "expense" ? "Pengeluaran" : "Pemasukan"}
              </button>
            ))}
          </div>
          <input className="field" type="number" min="1" placeholder="Nominal (Rp)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATS[form.type].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="field" placeholder="Catatan (opsional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Simpan transaksi</button>
        </form>

        <div className="panel lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Transaksi terbaru</h2>
            <select className="field !w-auto !py-1.5 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Semua</option><option value="income">Pemasukan</option><option value="expense">Pengeluaran</option>
            </select>
          </div>
          {list.length === 0 && <p className="py-8 text-center text-slate-500">Belum ada transaksi. Tambahkan yang pertama lewat formulir.</p>}
          <ul className="divide-y divide-slate-100">
            {list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold ${t.type === "income" ? "bg-teal-50 text-teal-600" : "bg-rose-50 text-rose-500"}`}>{t.type === "income" ? "+" : "−"}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.note || t.category}</p>
                  <p className="text-xs text-slate-500">{t.category} • {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <p className={`font-bold ${t.type === "income" ? "text-teal-600" : "text-rose-500"}`}>{t.type === "income" ? "+" : "−"}{rp(t.amount)}</p>
                <button onClick={() => remove(t.id)} aria-label="Hapus transaksi" className="rounded-lg px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500">✕</button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
      <p className="text-sm text-indigo-100">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
