import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { Protocol } from 'pmtiles';
import { initDraw } from './draw.js';
import properties from './data/properties.json';
import labels from './data/labels.json';

maplibregl.setWorkerUrl(workerUrl);
maplibregl.addProtocol('pmtiles', new Protocol().tile);

const CENTER = [109.159, 11.92]; // Cam Ranh

const OFM = 'https://tiles.openfreemap.org';

// Nguồn ảnh nền (chọn bằng biến môi trường trong file .env, xem .env.example):
//   VITE_IMAGERY_URL      -> ảnh của riêng bạn (drone / mua), dạng XYZ: https://.../{z}/{x}/{y}.jpg
//   VITE_ARCGIS_API_KEY   -> Esri World Imagery chính thức qua ArcGIS Location Platform
//   (không đặt gì)        -> tile công khai của Esri, chỉ nên dùng để thử nghiệm
const env = import.meta.env;
const IMAGERY = env.VITE_IMAGERY_URL
  ? { url: env.VITE_IMAGERY_URL, maxzoom: +(env.VITE_IMAGERY_MAXZOOM || 20), attribution: env.VITE_IMAGERY_ATTRIBUTION || '' }
  : env.VITE_ARCGIS_API_KEY
    ? { url: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${env.VITE_ARCGIS_API_KEY}`,
        maxzoom: +(env.VITE_IMAGERY_MAXZOOM || 18), attribution: 'Powered by Esri · Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' }
    : { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        maxzoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' };
if (!env.VITE_IMAGERY_URL && !env.VITE_ARCGIS_API_KEY) console.warn('Đang dùng tile Esri công khai (không có API key) - chỉ nên dùng để thử nghiệm. Xem .env.example.');
const labelFont = ['Noto Sans Regular'];

const style = {
  version: 8,
  glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
  sources: {
    sat: {
      type: 'raster', tileSize: 256, maxzoom: IMAGERY.maxzoom, tiles: [IMAGERY.url], attribution: IMAGERY.attribution
    },
    osm: { type: 'vector', url: `pmtiles://${location.origin}/camranh.pmtiles`, maxzoom: 14, attribution: '© OpenMapTiles © OpenStreetMap contributors' },
    bld: { type: 'vector', url: `pmtiles://${location.origin}/camranh-buildings.pmtiles`, maxzoom: 15, attribution: 'Buildings: Overture Maps (Microsoft, Google, OSM)' },
    dem: {
      type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13,
      url: `pmtiles://${location.origin}/camranh-dem.pmtiles`,
      attribution: 'Terrain: Mapzen, SRTM'
    },
    parcels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
  },
  terrain: { source: 'dem', exaggeration: 1 },
  sky: { 'sky-color': '#5aa9ff', 'horizon-color': '#cfe6ff', 'fog-color': '#e6f0fa', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.8, 'fog-ground-blend': 0.2 },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#f6f6f6' } },
    // --- chế độ Bản đồ (kiểu Google 3D vector) ---
    { id: 'm-landcover', type: 'fill', source: 'osm', 'source-layer': 'landcover',
      filter: ['in', 'class', 'wood', 'grass'], paint: { 'fill-color': '#e3efd9' } },
    { id: 'm-park', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': '#d7ebca' } },
    { id: 'm-water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': '#bcd9f0' } },
    { id: 'm-waterway', type: 'line', source: 'osm', 'source-layer': 'waterway', paint: { 'line-color': '#bcd9f0', 'line-width': 2 } },
    { id: 'm-sidewalk', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 16,
      filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'minor'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#e4e6ea', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 16, 12, 18, 40, 20, 90] } },
    { id: 'm-road-casing', type: 'line', source: 'osm', 'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#9fb0c8', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 1, 14, 5, 18, 26] } },
    { id: 'm-road', type: 'line', source: 'osm', 'source-layer': 'transportation',
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#b4c2d6', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, .6, 14, 3.5, 18, 22] } },
    { id: 'm-road-center', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 16,
      filter: ['in', 'class', 'primary', 'secondary', 'tertiary'],
      paint: { 'line-color': '#fff', 'line-dasharray': [4, 4], 'line-width': ['interpolate', ['linear'], ['zoom'], 16, .8, 20, 3] } },
    { id: 'm-buildings', type: 'fill-extrusion', source: 'bld', 'source-layer': 'building', minzoom: 13,
      paint: {
        'fill-extrusion-color': '#ebebf0',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-vertical-gradient': true
      } },
    // --- chế độ Vệ tinh ---
    { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' },
      paint: { 'raster-saturation': 0.3, 'raster-contrast': 0.15, 'raster-brightness-min': 0.04, 'raster-brightness-max': 0.96, 'raster-hue-rotate': -4, 'raster-fade-duration': 300 } },
    { id: 'roads', type: 'line', source: 'osm', 'source-layer': 'transportation', layout: { visibility: 'none' },
      filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'],
      paint: { 'line-color': 'rgba(255,255,255,.35)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, .5, 18, 6] } },
    { id: 'buildings', type: 'fill-extrusion', source: 'bld', 'source-layer': 'building', minzoom: 13, layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': '#f6efe3',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-opacity': 0.95
      } },
    { id: 'parcel-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': '#e8b84a', 'fill-opacity': 0.4 } },
    { id: 'parcel-line', type: 'line', source: 'parcels', paint: { 'line-color': '#e0a020', 'line-width': 3 } },
    // --- nhãn dùng chung (màu đổi theo chế độ) ---
    { id: 'road-names', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 14,
      layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']], 'text-font': labelFont, 'text-size': 13 },
      paint: { 'text-color': '#4a5a73', 'text-halo-color': '#fff', 'text-halo-width': 2 } },
    { id: 'poi-dot', type: 'circle', source: 'osm', 'source-layer': 'poi', minzoom: 15.5,
      paint: { 'circle-radius': 5, 'circle-color': ['match', ['get', 'class'],
        ['restaurant', 'fast_food', 'food_court'], '#f08a24', ['cafe', 'bar'], '#f08a24',
        ['lodging'], '#d63fb5', ['shop', 'grocery'], '#3b82f6', '#7b8794'],
        'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } },
    { id: 'poi-names', type: 'symbol', source: 'osm', 'source-layer': 'poi', minzoom: 15.5,
      layout: { 'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']], 'text-font': labelFont, 'text-size': 12, 'text-anchor': 'left', 'text-offset': [.9, 0], 'text-optional': true },
      paint: { 'text-color': '#c2410c', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } },
    { id: 'places', type: 'symbol', source: 'osm', 'source-layer': 'place', maxzoom: 15,
      layout: { 'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']], 'text-font': labelFont, 'text-size': 14 },
      paint: { 'text-color': '#2d3b55', 'text-halo-color': '#fff', 'text-halo-width': 2 } }
  ]
};

const map = new maplibregl.Map({
  container: 'map', style, center: CENTER, zoom: 12, pitch: 60, bearing: -20, maxPitch: 85, maxZoom: 19.5, hash: true
});
if (import.meta.env.DEV) window.map = map;
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl());

// --- Property UI ---
const $ = (id) => document.getElementById(id);
const markers = new Map();
let active = null, orbit = null, filter = 'Tất cả';

const fmtTel = (p) => p.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');

function renderList() {
  const types = ['Tất cả', ...new Set(properties.map((p) => p.type))];
  $('filters').innerHTML = types.map((t) => `<button class="${t === filter ? 'on' : ''}">${t}</button>`).join('');
  [...$('filters').children].forEach((b) => (b.onclick = () => { filter = b.textContent; renderList(); }));

  const shown = properties.filter((p) => filter === 'Tất cả' || p.type === filter);
  $('items').innerHTML = shown.map((p) => `<li data-id="${p.id}"><b>${p.title}</b><small>${p.price} · ${p.area}</small></li>`).join('');
  [...$('items').children].forEach((li) => (li.onclick = () => select(li.dataset.id)));
  markers.forEach((m, id) => (m.getElement().style.display = shown.some((p) => p.id === id) ? '' : 'none'));
}

function select(id) {
  const p = properties.find((x) => x.id === id);
  stopOrbit();
  active = p;
  markers.forEach((m, k) => m.getElement().classList.toggle('on', k === id));
  $('d-img').src = p.image;
  $('d-type').textContent = p.type;
  $('d-title').textContent = p.title;
  $('d-price').textContent = `${p.price} · ${p.area}`;
  $('d-info').innerHTML = Object.entries(p.info).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('d-desc').textContent = p.desc;
  $('d-call').textContent = `Liên hệ ${fmtTel(p.phone)}`;
  $('d-call').href = `tel:${p.phone}`;
  $('detail').hidden = false;

  map.getSource('parcels').setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...p.polygon, p.polygon[0]]] } }]
  });
  map.flyTo({ center: [p.lng, p.lat], zoom: 17.2, pitch: 65, bearing: map.getBearing() + 40, duration: 3500, essential: true });
}

function startOrbit(speed = 0.25) {
  if (!active) return;
  stopOrbit();
  map.easeTo({ center: [active.lng, active.lat], zoom: 17.5, pitch: 68, duration: 800 });
  const tick = () => { map.setBearing(map.getBearing() + speed); orbit = requestAnimationFrame(tick); };
  orbit = requestAnimationFrame(tick);
  map.once('mousedown', stopOrbit); map.once('touchstart', stopOrbit);
}
function stopOrbit() { if (orbit) cancelAnimationFrame(orbit); orbit = null; }

$('d-orbit').onclick = () => startOrbit();
$('close').onclick = () => {
  stopOrbit(); active = null; $('detail').hidden = true;
  markers.forEach((m) => m.getElement().classList.remove('on'));
  map.getSource('parcels').setData({ type: 'FeatureCollection', features: [] });
};

// Vệ tinh / Bản đồ
const MAP_LAYERS = ['m-sidewalk', 'm-road-center', 'm-landcover', 'm-park', 'm-water', 'm-waterway', 'm-road-casing', 'm-road', 'm-buildings'];
const SAT_LAYERS = ['sat', 'roads', 'buildings'];
let showBoxes = false, mode_ = 'map';
function setBoxes() {
  map.setLayoutProperty('buildings', 'visibility', mode_ === 'sat' && showBoxes ? 'visible' : 'none');
  $('b-boxes').textContent = `Khối nhà 3D trên ảnh vệ tinh: ${showBoxes ? 'Bật' : 'Tắt'}`;
  $('b-boxes').classList.toggle('on', showBoxes);
}
function setMode(mode) {
  mode_ = mode;
  const sat = mode === 'sat';
  MAP_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', sat ? 'none' : 'visible'));
  SAT_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', sat ? 'visible' : 'none'));
  setBoxes();
  map.setPaintProperty('bg', 'background-color', sat ? '#0b1d3a' : '#f6f6f6');
  map.setLayoutProperty('road-names', 'text-font', [sat ? 'Noto Sans Bold' : 'Noto Sans Regular']);
  map.setLayoutProperty('road-names', 'text-transform', sat ? 'uppercase' : 'none');
  map.setLayoutProperty('road-names', 'text-size', sat ? 15 : 13);
  map.setLayoutProperty('road-names', 'text-letter-spacing', sat ? 0.08 : 0);
  map.setPaintProperty('road-names', 'text-color', sat ? '#fff' : '#4a5a73');
  map.setPaintProperty('road-names', 'text-halo-color', sat ? '#0b1d3a' : '#fff');
  map.setPaintProperty('poi-names', 'text-color', sat ? '#ffd9a8' : '#c2410c');
  map.setPaintProperty('poi-names', 'text-halo-color', sat ? '#0b1d3a' : '#fff');
  map.setPaintProperty('places', 'text-color', sat ? '#fff' : '#2d3b55');
  map.setPaintProperty('places', 'text-halo-color', sat ? '#0b1d3a' : '#fff');
  document.querySelectorAll('#tools button').forEach((x) => x.classList.toggle('on', x.dataset.style === mode));
}
document.querySelectorAll('#tools button').forEach((b) => (b.onclick = () => { setMode(b.dataset.style); applyLook(look); }));

$('b-boxes').onclick = () => { showBoxes = !showBoxes; setBoxes(); };

// --- Ánh sáng & không khí ---
const LOOKS = {
  day: {
    sky: { 'sky-color': '#3f8fe6', 'horizon-color': '#d6ebff', 'fog-color': '#e3eef9', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.85, 'fog-ground-blend': 0.3 },
    light: { anchor: 'map', color: '#fff6e4', intensity: 0.38, position: [1.15, 215, 38] },
    raster: { 'raster-saturation': 0.3, 'raster-contrast': 0.15, 'raster-brightness-max': 0.96, 'raster-hue-rotate': -4 }
  },
  dusk: {
    sky: { 'sky-color': '#2c4f95', 'horizon-color': '#ffb77a', 'fog-color': '#f2b48a', 'sky-horizon-blend': 0.75, 'horizon-fog-blend': 0.9, 'fog-ground-blend': 0.55 },
    light: { anchor: 'map', color: '#ffd0a0', intensity: 0.42, position: [1.15, 255, 78] },
    raster: { 'raster-saturation': 0.38, 'raster-contrast': 0.2, 'raster-brightness-max': 0.88, 'raster-hue-rotate': 10 }
  }
};
let look = 'day';
function applyLook(name) {
  look = name; const L = LOOKS[name];
  map.setSky(L.sky); map.setLight(L.light);
  Object.entries(L.raster).forEach(([k, v]) => map.setPaintProperty('sat', k, v));
  document.querySelectorAll('#view [data-look]').forEach((b) => b.classList.toggle('on', b.dataset.look === name));
}
document.querySelectorAll('#view [data-look]').forEach((b) => (b.onclick = () => applyLook(b.dataset.look)));

// --- Nhãn nổi kiểu quảng cáo (labels.json) ---
const callouts = labels.map((l) => {
  const el = Object.assign(document.createElement('div'), { className: 'callout', textContent: l.text });
  new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat]).addTo(map);
  return { el, l };
});
const syncCallouts = () => { const z = map.getZoom(); callouts.forEach(({ el, l }) => el.classList.toggle('off', z < l.minZoom || z > l.maxZoom)); };
map.on('zoom', syncCallouts); syncCallouts();

// --- Quay phim quảng cáo + ẩn giao diện ---
const setClean = (on) => { document.body.classList.toggle('clean', on); $('show-ui').hidden = !on; };
$('b-clean').onclick = () => setClean(true);
$('show-ui').onclick = () => { stopOrbit(); setClean(false); };
function cinematic() {
  stopOrbit();
  const p = active || properties[0]; if (!p) return;
  setClean(true);
  const stop = () => { stopOrbit(); setClean(false); map.off('mousedown', stop); map.off('touchstart', stop); map.off('wheel', stop); };
  map.flyTo({ center: [p.lng, p.lat], zoom: 17.4, pitch: 70, bearing: -35, duration: 4500, essential: true });
  map.once('moveend', () => {
    const t0 = performance.now(), z0 = map.getZoom();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      map.jumpTo({ bearing: -35 + t * 4, zoom: Math.min(18.2, z0 + t * 0.015), pitch: Math.max(58, 70 - t * 0.3) });
      orbit = requestAnimationFrame(tick);
    };
    orbit = requestAnimationFrame(tick);
    map.on('mousedown', stop); map.on('touchstart', stop); map.on('wheel', stop);
  });
}
$('b-cine').onclick = cinematic;
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('clean')) { stopOrbit(); setClean(false); } });

// Điều khiển góc nhìn 3D
const TERRAIN_DEFAULT = 1;
const heightExpr = (k) => ['*', k, ['coalesce', ['get', 'render_height'], 6]];
const bind = (id, out, fmt, onInput) => {
  const el = $(id); el.oninput = () => { $(out).textContent = fmt(+el.value); onInput(+el.value); };
  return (v) => { el.value = v; $(out).textContent = fmt(+el.value); };
};
const showPitch = bind('s-pitch', 'o-pitch', (v) => `${v}°`, (v) => { stopOrbit(); map.setPitch(v); syncPresets(); });
const showBearing = bind('s-bearing', 'o-bearing', (v) => `${v}°`, (v) => { stopOrbit(); map.setBearing(v); });
bind('s-bh', 'o-bh', (v) => `×${v}`, (k) => ['m-buildings', 'buildings'].forEach((l) => map.setPaintProperty(l, 'fill-extrusion-height', heightExpr(k))))(1);
bind('s-th', 'o-th', (v) => `×${v}`, (k) => map.setTerrain({ source: 'dem', exaggeration: k }))(TERRAIN_DEFAULT);
function syncPresets() {
  document.querySelectorAll('#view .presets button[data-pitch]').forEach((b) =>
    b.classList.toggle('on', Math.abs(+b.dataset.pitch - map.getPitch()) < 3));
}
document.querySelectorAll('#view .presets button[data-pitch]').forEach((b) => (b.onclick = () => {
  stopOrbit(); map.easeTo({ pitch: +b.dataset.pitch, duration: 900 });
}));
// Đồng bộ thanh trượt khi người dùng kéo chuột phải / dùng phím
map.on('pitch', () => { showPitch(Math.round(map.getPitch())); syncPresets(); });
map.on('rotate', () => showBearing(Math.round(map.getBearing())));
showPitch(Math.round(map.getPitch())); showBearing(Math.round(map.getBearing())); syncPresets();

map.on('load', () => {
  applyLook('day');
  initDraw(map, { stopOrbit, closeDetail: () => { if (!$('detail').hidden) $('close').click(); } });
  properties.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'pin'; el.textContent = p.price;
    el.onclick = (e) => { e.stopPropagation(); select(p.id); };
    markers.set(p.id, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map));
  });
  renderList();
});
