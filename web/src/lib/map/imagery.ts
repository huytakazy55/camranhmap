// Nguồn ảnh nền (đặt trong web/.env.local, hoặc build-arg khi chạy Docker; xem .env.example):
//   NEXT_PUBLIC_IMAGERY_URL     -> ảnh của riêng bạn (drone / mua), dạng XYZ: https://.../{z}/{x}/{y}.jpg
//   NEXT_PUBLIC_ARCGIS_API_KEY  -> Esri World Imagery chính thức qua ArcGIS Location Platform
//   (không đặt gì)              -> tile công khai của Esri, chỉ nên dùng để thử nghiệm
// Lưu ý: Next.js chỉ gắn biến vào mã khi viết nguyên tên `process.env.NEXT_PUBLIC_...`, không dùng biến động.
const IMAGERY_URL = process.env.NEXT_PUBLIC_IMAGERY_URL;
const IMAGERY_MAXZOOM = process.env.NEXT_PUBLIC_IMAGERY_MAXZOOM;
const IMAGERY_ATTRIBUTION = process.env.NEXT_PUBLIC_IMAGERY_ATTRIBUTION;
const ARCGIS_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

export type Imagery = { url: string; maxzoom: number; attribution: string; official: boolean };

export function getImagery(): Imagery {
  if (IMAGERY_URL) return { url: IMAGERY_URL, maxzoom: +(IMAGERY_MAXZOOM || 20), attribution: IMAGERY_ATTRIBUTION || '', official: true };
  if (ARCGIS_KEY) {
    return {
      url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`,
      maxzoom: +(IMAGERY_MAXZOOM || 18),
      attribution: 'Powered by Esri · Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      official: true,
    };
  }
  return {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 18,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    official: false,
  };
}
