import 'server-only';
import type { Property } from './types';

const API_URL = process.env.API_URL ?? 'http://localhost:5080';

async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);
  return res.json() as Promise<T>;
}

export const getProperties = async () => (await get<Property[]>('/api/properties')) ?? [];
export const getProperty = (slug: string) => get<Property>(`/api/properties/${encodeURIComponent(slug)}`);
