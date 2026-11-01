import { NextResponse } from 'next/server';
import { adminPassword, isAdmin } from '@/lib/admin';

const API_URL = process.env.API_URL ?? 'http://localhost:5080';
type Ctx = { params: Promise<{ slug: string }> };

async function forward(method: 'PUT' | 'DELETE', req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  if (method === 'PUT' && !req.headers.get('content-type')?.includes('application/json'))
    return NextResponse.json({ error: 'Sai định dạng.' }, { status: 415 });

  const { slug } = await params;
  const upstream = await fetch(`${API_URL}/api/properties/${encodeURIComponent(slug)}`, {
    method,
    headers: { 'content-type': 'application/json', 'X-Admin-Key': adminPassword() },
    body: method === 'PUT' ? await req.text() : undefined,
    cache: 'no-store',
  });
  return new NextResponse(upstream.status === 204 ? null : await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const PUT = (req: Request, ctx: Ctx) => forward('PUT', req, ctx);
export const DELETE = (req: Request, ctx: Ctx) => forward('DELETE', req, ctx);
