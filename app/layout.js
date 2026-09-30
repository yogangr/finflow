import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata = { title: "FinFlow — Dasbor Keuangan Pribadi", description: "Pantau pemasukan, pengeluaran, dan tabunganmu." };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={jakarta.variable}>{children}</body>
    </html>
  );
}
