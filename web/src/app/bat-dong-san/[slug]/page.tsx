import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MapApp from '@/components/MapApp';
import { getProperties, getProperty } from '@/lib/api';
import { formatArea, formatPrice, propertyPath } from '@/lib/format';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) return {};
  const summary = `${p.type} ${formatArea(p.areaM2)}, giá ${formatPrice(p.priceVnd)} tại Cam Ranh. ${p.desc}`;
  return {
    title: p.title,
    description: summary,
    alternates: { canonical: propertyPath(p.slug) },
    openGraph: { title: p.title, description: summary, url: propertyPath(p.slug), ...(p.image && { images: [p.image] }) },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const [property, properties] = await Promise.all([getProperty(slug), getProperties()]);
  if (!property) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.desc,
    url: `${SITE_URL}${propertyPath(property.slug)}`,
    ...(property.image && { image: property.image }),
    offers: { '@type': 'Offer', price: property.priceVnd, priceCurrency: 'VND' },
    about: {
      '@type': 'Place',
      name: property.title,
      geo: { '@type': 'GeoCoordinates', latitude: property.lat, longitude: property.lng },
      address: { '@type': 'PostalAddress', addressLocality: 'Cam Ranh', addressRegion: 'Khánh Hòa', addressCountry: 'VN' },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <MapApp properties={properties} initialSlug={property.slug} />
    </>
  );
}
