import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE = 'cr_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 ngày

/** Mật khẩu quản trị. Chưa đặt thì tắt hẳn khu quản trị. */
export const adminPassword = () => process.env.ADMIN_PASSWORD || '';

const sign = (payload: string) => createHmac('sha256', adminPassword()).update(`camranh-admin:${payload}`).digest('hex');

export function makeToken() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  return `${exp}.${sign(exp)}`;
}

function validToken(token: string | undefined) {
  if (!token || !adminPassword()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || +exp < Date.now() / 1000) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin() {
  return validToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: (process.env.SITE_URL ?? '').startsWith('https://'),
  path: '/',
  maxAge: MAX_AGE,
};
