import { NextResponse } from 'next/server';
import { adminPassword, isAdmin } from '@/lib/admin';

const API_URL = process.env.API_URL ?? 'http://localhost:5080';

/** Chuyển tiếp yêu cầu thêm bất động sản sang API .NET, kèm khóa quản trị (khóa không bao giờ xuống trình duyệt). */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  if (!req.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'Sai định dạng.' }, { status: 415 });

  const upstream = await fetch(`${API_URL}/api/properties`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Admin-Key': adminPassword() },
    body: await req.text(),
    cache: 'no-store',
  });
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
