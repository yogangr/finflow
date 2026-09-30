# FinFlow — Personal Finance Dashboard (Next.js + Neon)

## Jalankan lokal
1. Buat database gratis di https://neon.tech, salin connection string.
2. `cp .env.example .env.local` lalu isi `DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`.
3. `npm install && npm run dev` → http://localhost:3000
   (tabel dibuat otomatis saat pertama kali dipakai)

## Deploy gratis ke Vercel
1. Push folder ini ke repo GitHub.
2. Di vercel.com → Add New → Project → pilih repo tersebut.
3. Di Environment Variables, isi `DATABASE_URL`, `APP_PASSWORD`, `AUTH_SECRET`.
4. Klik Deploy. Selesai.
