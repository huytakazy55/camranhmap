import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminPassword, cookieOptions, makeToken } from '@/lib/admin';

export async function POST(req: Request) {
  if (!adminPassword()) return NextResponse.json({ error: 'Chưa cấu hình ADMIN_PASSWORD.' }, { status: 503 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const a = Buffer.from(String(password ?? '')), b = Buffer.from(adminPassword());
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await new Promise((r) => setTimeout(r, 800)); // làm chậm việc dò mật khẩu
    return NextResponse.json({ error: 'Sai mật khẩu.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeToken(), cookieOptions);
  return res;
}
