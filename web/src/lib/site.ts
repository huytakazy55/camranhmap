export const SITE_NAME = 'Cam Ranh 3D';
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Chỉ cho Google lập chỉ mục khi đặt ALLOW_INDEXING=true (tránh lập chỉ mục dữ liệu mẫu / môi trường thử). */
export const ALLOW_INDEXING = process.env.ALLOW_INDEXING === 'true';
