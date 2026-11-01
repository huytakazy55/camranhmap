import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return ALLOW_INDEXING
    ? { rules: { userAgent: '*', allow: '/', disallow: ['/tiles/', '/admin', '/api/'] }, sitemap: `${SITE_URL}/sitemap.xml` }
    : { rules: { userAgent: '*', disallow: '/' } };
}
