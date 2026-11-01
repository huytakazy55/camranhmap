const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });

/** 5_200_000_000 -> "5,2 tỷ"; 850_000_000 -> "850 triệu" */
export function formatPrice(vnd: number): string {
  if (vnd >= 1e9) return `${nf.format(vnd / 1e9)} tỷ`;
  if (vnd >= 1e6) return `${nf.format(vnd / 1e6)} triệu`;
  return `${nf.format(vnd)} đ`;
}

export const formatArea = (m2: number) => `${nf.format(m2)} m²`;

export const formatTel = (p: string) => p.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');

export const propertyPath = (slug: string) => `/bat-dong-san/${slug}`;
