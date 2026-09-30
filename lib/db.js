import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
let ready;

export function db() {
  ready ??= sql`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount BIGINT NOT NULL,
    category TEXT NOT NULL,
    note TEXT DEFAULT '',
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )`;
  return ready.then(() => sql);
}
