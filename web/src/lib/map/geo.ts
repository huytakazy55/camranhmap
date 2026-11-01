export type Pt = [number, number]; // [lng, lat]

/** Diện tích (m²) và tâm của đa giác nhỏ, quy ra mét quanh vĩ độ trung bình. */
export function polygonStats(ring: Pt[]): { areaM2: number; center: Pt } {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180), ky = 110_540;
  const xy = ring.map(([lng, lat]) => [lng * kx, lat * ky] as Pt);
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(a) < 1e-6) return { areaM2: 0, center: [ring[0][0], ring[0][1]] };
  return { areaM2: Math.abs(a) / 2, center: [cx / (3 * a) / kx, cy / (3 * a) / ky] };
}

const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const segCross = (p1: Pt, p2: Pt, p3: Pt, p4: Pt) =>
  cross(p1, p2, p3) * cross(p1, p2, p4) < 0 && cross(p3, p4, p1) * cross(p3, p4, p2) < 0;

/** Có hai cạnh không liền kề cắt nhau (đa giác tự cắt)? */
export function selfIntersects(ring: Pt[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}
