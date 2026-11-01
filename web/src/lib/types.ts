export type InfoItem = { label: string; value: string };

export type Property = {
  id: string;
  slug: string;
  type: string;
  title: string;
  priceVnd: number;
  areaM2: number;
  lng: number;
  lat: number;
  polygon: [number, number][];
  info: InfoItem[];
  desc: string;
  phone: string;
  image: string;
};

/** Dữ liệu gửi lên khi thêm bất động sản (id và slug do máy chủ sinh). */
export type PropertyInput = Omit<Property, 'id' | 'slug'>;
