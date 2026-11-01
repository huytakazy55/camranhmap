// Công cụ vẽ nhà: vẽ đa giác trên bản đồ, đặt số tầng / màu / mái, lưu localStorage, xuất-nhập GeoJSON.
import type { Map as MLMap, MapMouseEvent, GeoJSONSource } from 'maplibre-gl';

type Pt = [number, number];
type House = {
  id: string; name: string; floors: number; floorH: number; wall: string; roof: 'flat' | 'hip'; roofColor: string;
  ring: Pt[]; hides: (string | number)[];
};

const KEY = 'camranh.houses.v1';
const BASE_LAYERS = ['m-buildings', 'buildings'];
const EMPTY = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;

const inRing = (pt: Pt, ring: Pt[]) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const centroid = (r: Pt[]): Pt => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
const outer = (g: GeoJSON.Geometry): Pt[] =>
  (g.type === 'MultiPolygon' ? g.coordinates[0][0] : (g as GeoJSON.Polygon).coordinates[0]) as Pt[];
const scaleRing = (r: Pt[], k: number): Pt[] => { const c = centroid(r); return r.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]); };
const shade = (hex: string, f: number) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');

function houseFeatures(h: House): GeoJSON.Feature[] {
  const wallH = h.floors * h.floorH;
  const poly = (ring: Pt[], base: number, height: number, color: string): GeoJSON.Feature => ({
    type: 'Feature', properties: { hid: h.id, b: base, h: height, c: color },
    geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
  });
  const f = [poly(h.ring, 0, wallH, h.wall)];
  if (h.roof === 'hip') {
    f.push(poly(scaleRing(h.ring, 1.08), wallH, wallH + 0.25, shade(h.roofColor, 0.8))); // mái hiên
    [0.9, 0.68, 0.46, 0.24].forEach((k, i) => f.push(poly(scaleRing(h.ring, k), wallH + 0.25 + i * 0.6, wallH + 0.25 + (i + 1) * 0.6, shade(h.roofColor, 1 - i * 0.04))));
  } else f.push(poly(scaleRing(h.ring, 1.02), wallH, wallH + 0.35, h.roofColor));
  return f;
}

type Hooks = { stopOrbit: () => void; closeDetail: () => void };

/** Trả về: dispose (gỡ giao diện, trình lắng nghe) và cancel (thoát chế độ vẽ / đóng bảng chỉnh nếu đang mở). */
export function initDraw(map: MLMap, { stopOrbit, closeDetail }: Hooks): { dispose: () => void; cancel: () => void } {
  let houses: House[] = [];
  try { houses = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* bỏ qua */ }
  let mode: 'idle' | 'drawing' = 'idle', pts: Pt[] = [], hover: Pt | null = null, selId: string | null = null;

  // --- UI ---
  const hint = Object.assign(document.createElement('div'), { id: 'draw-hint', hidden: true });
  const ed = Object.assign(document.createElement('section'), { id: 'editor', hidden: true });
  ed.innerHTML = `
    <button id="e-close" aria-label="Đóng">×</button>
    <h3>Ngôi nhà</h3>
    <label>Tên<input id="e-name" /></label>
    <div class="row"><label>Số tầng<input id="e-floors" type="number" min="1" max="60" /></label>
      <label>Cao/tầng (m)<input id="e-fh" type="number" min="2.4" max="6" step="0.1" /></label></div>
    <div class="row"><label>Màu tường<input id="e-wall" type="color" /></label>
      <label>Màu mái<input id="e-rcolor" type="color" /></label></div>
    <label>Kiểu mái<select id="e-roof"><option value="flat">Mái bằng</option><option value="hip">Mái dốc</option></select></label>
    <p id="e-info"></p>
    <button id="e-redo" class="ghost">Dò lại nhà nền cần ẩn</button>
    <button id="e-del" class="ghost danger">Xóa ngôi nhà</button>`;
  const bar = Object.assign(document.createElement('div'), { id: 'draw-bar' });
  bar.innerHTML = `<button id="b-draw">✏️ Vẽ nhà</button><button id="b-exp" class="ghost">Xuất</button>
    <label class="ghost file">Nhập<input id="b-imp" type="file" accept=".geojson,.json" hidden /></label>`;
  document.body.append(hint, ed, bar);
  const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;

  // --- layers ---
  const beforeId = 'road-names';
  map.addSource('houses', { type: 'geojson', data: EMPTY });
  map.addSource('draft', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'houses', type: 'fill-extrusion', source: 'houses',
    paint: { 'fill-extrusion-color': ['get', 'c'], 'fill-extrusion-base': ['get', 'b'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-vertical-gradient': true } }, beforeId);
  map.addLayer({ id: 'house-sel', type: 'line', source: 'houses', filter: ['==', ['get', 'hid'], ''],
    paint: { 'line-color': '#ffb703', 'line-width': 3 } }, beforeId);
  map.addLayer({ id: 'draft-fill', type: 'fill', source: 'draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#ffb703', 'fill-opacity': 0.3 } }, beforeId);
  map.addLayer({ id: 'draft-line', type: 'line', source: 'draft', filter: ['!=', '$type', 'Point'], paint: { 'line-color': '#ffb703', 'line-width': 2.5, 'line-dasharray': [2, 1] } }, beforeId);
  map.addLayer({ id: 'draft-pts', type: 'circle', source: 'draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#ffb703', 'circle-stroke-width': 2.5 } }, beforeId);

  const setData = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as GeoJSONSource).setData(data);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(houses)); } catch { /* đầy bộ nhớ */ } };
  function refresh() {
    setData('houses', { type: 'FeatureCollection', features: houses.flatMap(houseFeatures) });
    const ids = houses.flatMap((h) => h.hides || []);
    BASE_LAYERS.forEach((l) => map.setFilter(l, ids.length ? ['!', ['in', ['id'], ['literal', ids]]] : null));
    map.setFilter('house-sel', ['==', ['get', 'hid'], selId || '']);
  }
  function drawDraft() {
    const ring = hover ? [...pts, hover] : pts;
    const feats: GeoJSON.Feature[] = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    if (ring.length >= 2) feats.push({ type: 'Feature', properties: {}, geometry: ring.length >= 3
      ? { type: 'Polygon', coordinates: [[...ring, ring[0]]] } : { type: 'LineString', coordinates: ring } });
    setData('draft', { type: 'FeatureCollection', features: feats });
  }

  // --- nhà nền bị đè ---
  function detectHides(ring: Pt[]) {
    const found = new Map<string | number, 1>();
    for (const f of map.querySourceFeatures('bld', { sourceLayer: 'building' })) {
      if (f.id == null || found.has(f.id)) continue;
      const b = outer(f.geometry);
      if (b.some((p) => inRing(p, ring)) || ring.some((p) => inRing(p, b)) || inRing(centroid(b), ring) || inRing(centroid(ring), b)) found.set(f.id, 1);
    }
    return [...found.keys()];
  }

  // --- chế độ ---
  function setHint(t: string) { hint.hidden = !t; hint.textContent = t || ''; }
  function startDraw() {
    stopOrbit(); closeDetail(); closeEditor(); mode = 'drawing'; pts = []; hover = null;
    map.doubleClickZoom.disable(); map.getCanvas().style.cursor = 'crosshair'; $('b-draw').classList.add('on'); drawDraft();
    setHint('Bấm để đặt từng góc nhà · Bấm lại điểm đầu / Enter để hoàn tất · Backspace lùi một điểm · Esc hủy');
  }
  function endDraw() {
    mode = 'idle'; pts = []; hover = null; map.doubleClickZoom.enable(); map.getCanvas().style.cursor = '';
    $('b-draw').classList.remove('on'); setHint(''); drawDraft();
  }
  function finish() {
    if (pts.length < 3) return;
    const h: House = { id: 'h' + Date.now().toString(36), name: `Nhà ${houses.length + 1}`, floors: 3, floorH: 3.2, wall: '#f2ece0', roof: 'hip', roofColor: '#b5533c', ring: pts, hides: [] };
    h.hides = detectHides(h.ring); houses.push(h); endDraw(); save(); select(h.id);
  }
  function select(id: string) {
    const h = houses.find((x) => x.id === id); if (!h) return;
    closeDetail(); selId = id; ed.hidden = false;
    $('e-name').value = h.name; $('e-floors').value = String(h.floors); $('e-fh').value = String(h.floorH);
    $('e-wall').value = h.wall; $('e-rcolor').value = h.roofColor; $<HTMLSelectElement>('e-roof').value = h.roof; info(h); refresh();
  }
  const info = (h: House) => ($('e-info').textContent = `Cao ${(h.floors * h.floorH).toFixed(1)} m · đã ẩn ${h.hides.length} khối nhà nền bị đè`);
  function closeEditor() { ed.hidden = true; selId = null; if (map.getLayer('house-sel')) refresh(); }

  const live = (id: string, key: keyof House, conv: (v: string) => unknown = (v) => v) => ($(id).oninput = () => {
    const h = houses.find((x) => x.id === selId); if (!h) return;
    const v = conv($(id).value); if (v === null) return;
    (h as Record<string, unknown>)[key] = v; info(h); save(); refresh();
  });
  live('e-name', 'name'); live('e-wall', 'wall'); live('e-rcolor', 'roofColor'); live('e-roof', 'roof');
  live('e-floors', 'floors', (v) => (+v >= 1 ? Math.round(+v) : null)); live('e-fh', 'floorH', (v) => (+v >= 2.4 ? +v : null));
  $('e-close').onclick = closeEditor;
  $('e-redo').onclick = () => { const h = houses.find((x) => x.id === selId); if (h) { h.hides = detectHides(h.ring); info(h); save(); refresh(); } };
  $('e-del').onclick = () => { houses = houses.filter((x) => x.id !== selId); save(); closeEditor(); refresh(); };

  // --- sự kiện bản đồ ---
  const onClick = (e: MapMouseEvent) => {
    if (mode === 'drawing') {
      const p: Pt = [e.lngLat.lng, e.lngLat.lat];
      if (pts.length >= 3) { const a = map.project(pts[0]); if (Math.hypot(a.x - e.point.x, a.y - e.point.y) < 12) return finish(); }
      pts.push(p); return drawDraft();
    }
    const hit = map.queryRenderedFeatures(e.point, { layers: ['houses'] })[0];
    if (hit) select(hit.properties.hid);
  };
  const onMove = (e: MapMouseEvent) => {
    if (mode === 'drawing') { hover = [e.lngLat.lng, e.lngLat.lat]; drawDraft(); }
    else map.getCanvas().style.cursor = map.queryRenderedFeatures(e.point, { layers: ['houses'] }).length ? 'pointer' : '';
  };
  const onKey = (e: KeyboardEvent) => {
    if (/INPUT|SELECT/.test(document.activeElement?.tagName ?? '')) return;
    if (mode === 'drawing') {
      if (e.key === 'Escape') endDraw(); else if (e.key === 'Enter') finish();
      else if (e.key === 'Backspace') { e.preventDefault(); pts.pop(); drawDraft(); }
    } else if (e.key === 'Escape') closeEditor();
  };
  map.on('click', onClick);
  map.on('mousemove', onMove);
  window.addEventListener('keydown', onKey);
  $('b-draw').onclick = () => (mode === 'drawing' ? endDraw() : startDraw());

  // --- xuất / nhập ---
  $('b-exp').onclick = () => {
    const fc = { type: 'FeatureCollection', features: houses.map((h) => ({ type: 'Feature', properties: { ...h, ring: undefined },
      geometry: { type: 'Polygon', coordinates: [[...h.ring, h.ring[0]]] } })) };
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JSON.stringify(fc, null, 1)], { type: 'application/geo+json' })), download: 'nha-da-ve.geojson' });
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('b-imp').onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0]; if (!file) return;
    try {
      const fc = JSON.parse(await file.text());
      const incoming: House[] = fc.features.map((f: GeoJSON.Feature<GeoJSON.Polygon>) => ({ ...f.properties, ring: f.geometry.coordinates[0].slice(0, -1) }))
        .filter((h: House) => h.id && h.ring.length >= 3 && h.floors && h.floorH);
      houses = [...houses.filter((x) => !incoming.some((i) => i.id === x.id)), ...incoming]; save(); refresh();
    } catch { alert('File không hợp lệ'); }
    input.value = '';
  };

  refresh();

  return {
    dispose: () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      hint.remove(); ed.remove(); bar.remove();
    },
    cancel: () => { if (mode === 'drawing') endDraw(); closeEditor(); },
  };
}
