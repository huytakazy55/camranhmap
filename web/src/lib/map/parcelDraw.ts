// Vẽ ranh khu đất bằng cách chấm các góc trên bản đồ 3D. Khu đất đang vẽ/đã vẽ hiện bằng lớp 'pdraft'.
import type { GeoJSONSource, Map as MLMap, MapMouseEvent } from 'maplibre-gl';
import { selfIntersects, type Pt } from './geo';

const SRC = 'pdraft';
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
const BEFORE = 'road-names';

function ensureLayers(map: MLMap) {
  if (map.getSource(SRC)) return;
  map.addSource(SRC, { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'pdraft-fill', type: 'fill', source: SRC, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#ffb703', 'fill-opacity': 0.35 } }, BEFORE);
  map.addLayer({ id: 'pdraft-line', type: 'line', source: SRC, filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#ffb703', 'line-width': 3 } }, BEFORE);
  map.addLayer({ id: 'pdraft-pts', type: 'circle', source: SRC, filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': '#ffb703', 'circle-stroke-width': 3 } }, BEFORE);
}

function show(map: MLMap, pts: Pt[], hover: Pt | null, closed: boolean) {
  const ring = hover ? [...pts, hover] : pts;
  const feats: GeoJSON.Feature[] = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
  if (ring.length >= 2) feats.push({ type: 'Feature', properties: {}, geometry: ring.length >= 3 || closed
    ? { type: 'Polygon', coordinates: [[...ring, ring[0]]] } : { type: 'LineString', coordinates: ring } });
  (map.getSource(SRC) as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
}

export const clearParcelPreview = (map: MLMap) => { if (map.getSource(SRC)) (map.getSource(SRC) as GeoJSONSource).setData(EMPTY); };

type Hooks = {
  onChange: (count: number) => void;
  onInvalid: (message: string) => void;
  onDone: (ring: Pt[]) => void;
};

/**
 * Bắt đầu chế độ chấm điểm. Bấm để thêm góc; bấm lại điểm đầu hoặc Enter để hoàn tất;
 * Backspace lùi một điểm; Esc hủy. Trả về hàm dừng (không xóa hình đã vẽ, trừ khi truyền clear = true).
 */
export function startParcelDraw(map: MLMap, { onChange, onInvalid, onDone }: Hooks): (clear?: boolean) => void {
  ensureLayers(map);
  let pts: Pt[] = [], hover: Pt | null = null, stopped = false;
  const canvas = map.getCanvas();
  map.doubleClickZoom.disable();
  canvas.style.cursor = 'crosshair';
  show(map, pts, null, false); onChange(0);

  const redraw = () => { show(map, pts, hover, false); onChange(pts.length); };

  function finish() {
    if (pts.length < 3) return onInvalid('Cần ít nhất 3 góc.');
    if (selfIntersects(pts)) return onInvalid('Các cạnh đang cắt nhau, bấm Backspace lùi lại rồi chấm lại.');
    const done = pts;
    hover = null; show(map, done, null, true);
    stop(false); onDone(done);
  }

  const onClick = (e: MapMouseEvent) => {
    if (pts.length >= 3) {
      const a = map.project(pts[0]);
      if (Math.hypot(a.x - e.point.x, a.y - e.point.y) < 14) return finish();
    }
    pts = [...pts, [e.lngLat.lng, e.lngLat.lat]]; redraw();
  };
  const onMove = (e: MapMouseEvent) => { hover = [e.lngLat.lng, e.lngLat.lat]; redraw(); };
  const onKey = (e: KeyboardEvent) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) return;
    if (e.key === 'Enter') finish();
    else if (e.key === 'Backspace') { e.preventDefault(); pts = pts.slice(0, -1); redraw(); }
    else if (e.key === 'Escape') stop(true);
  };
  map.on('click', onClick); map.on('mousemove', onMove);
  window.addEventListener('keydown', onKey);

  function stop(clear = false) {
    if (stopped) return;
    stopped = true;
    map.off('click', onClick); map.off('mousemove', onMove);
    window.removeEventListener('keydown', onKey);
    map.doubleClickZoom.enable(); canvas.style.cursor = '';
    if (clear) { clearParcelPreview(map); onChange(-1); }
  }
  return stop;
}

/** Hiện sẵn một ranh đất đã có (khi sửa tin). */
export function previewParcel(map: MLMap, ring: Pt[]) {
  ensureLayers(map);
  show(map, ring, null, true);
}
