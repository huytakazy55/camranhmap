import type { Metadata, Viewport } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import { ALLOW_INDEXING, SITE_NAME, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} – Bản đồ bất động sản Cam Ranh`, template: `%s | ${SITE_NAME}` },
  description: 'Xem đất nền, nhà phố, biệt thự khu vực Cam Ranh (Khánh Hòa) trên bản đồ 3D: quan sát vị trí, địa hình, biển và khu lân cận ngay từ trên cao.',
  robots: ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { siteName: SITE_NAME, locale: 'vi_VN', type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
