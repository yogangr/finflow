import crypto from "crypto";
import { cookies } from "next/headers";

const NAME = "ff_session";
const DAYS = 7;
const sign = (v) => crypto.createHmac("sha256", process.env.AUTH_SECRET || "").update(v).digest("hex");

export async function isAuthed() {
  const c = (await cookies()).get(NAME)?.value;
  if (!c || !process.env.AUTH_SECRET) return false;
  const [exp, sig] = c.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export async function createSession() {
  const exp = String(Date.now() + DAYS * 864e5);
  (await cookies()).set(NAME, `${exp}.${sign(exp)}`, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400,
  });
}

export async function destroySession() {
  (await cookies()).delete(NAME);
}

export function passwordOk(input) {
  const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
  return !!process.env.APP_PASSWORD && crypto.timingSafeEqual(h(input), h(process.env.APP_PASSWORD));
}
