import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import MapApp from '@/components/MapApp';
import { isAdmin } from '@/lib/admin';
import { getProperties } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quản trị', robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  return <MapApp properties={await getProperties()} admin />;
}
