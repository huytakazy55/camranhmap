import type { MetadataRoute } from 'next';
import { getProperties } from '@/lib/api';
import { propertyPath } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const properties = await getProperties();
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    ...properties.map((p) => ({ url: `${SITE_URL}${propertyPath(p.slug)}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
  ];
}
