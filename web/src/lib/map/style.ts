import type { StyleSpecification } from 'maplibre-gl';
import { getImagery } from './imagery';

const OFM = 'https://tiles.openfreemap.org';
const labelFont = ['Noto Sans Regular'];

/** Thư mục chứa các file .pmtiles (nginx phục vụ ở /tiles; khi chạy `npm run dev` Next phục vụ từ public/tiles). */
const TILES = process.env.NEXT_PUBLIC_TILES_BASE ?? '/tiles';

export function buildStyle(origin: string): StyleSpecification {
  const imagery = getImagery();
  const pm = (file: string) => `pmtiles://${origin}${TILES}/${file}`;
  return {
    version: 8,
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      sat: { type: 'raster', tileSize: 256, maxzoom: imagery.maxzoom, tiles: [imagery.url], attribution: imagery.attribution },
      osm: { type: 'vector', url: pm('camranh.pmtiles'), maxzoom: 14, attribution: '© OpenMapTiles © OpenStreetMap contributors' },
      bld: { type: 'vector', url: pm('camranh-buildings.pmtiles'), maxzoom: 15, attribution: 'Buildings: Overture Maps (Microsoft, Google, OSM)' },
      dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13, url: pm('camranh-dem.pmtiles'), attribution: 'Terrain: Mapzen, SRTM' },
      parcels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    terrain: { source: 'dem', exaggeration: 1 },
    sky: { 'sky-color': '#5aa9ff', 'horizon-color': '#cfe6ff', 'fog-color': '#e6f0fa', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.8, 'fog-ground-blend': 0.2 },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f6f6f6' } },
      // --- chế độ Bản đồ (kiểu Google 3D vector) ---
      { id: 'm-landcover', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['in', 'class', 'wood', 'grass'], paint: { 'fill-color': '#e3efd9' } },
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
        paint: { 'line-color': '#b4c2d6', 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 10, 0.6, 14, 3.5, 18, 22] } },
      { id: 'm-road-center', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 16,
        filter: ['in', 'class', 'primary', 'secondary', 'tertiary'],
        paint: { 'line-color': '#fff', 'line-dasharray': [4, 4], 'line-width': ['interpolate', ['linear'], ['zoom'], 16, 0.8, 20, 3] } },
      { id: 'm-buildings', type: 'fill-extrusion', source: 'bld', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': '#ebebf0',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-vertical-gradient': true,
        } },
      // --- chế độ Vệ tinh ---
      { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' },
        paint: { 'raster-saturation': 0.3, 'raster-contrast': 0.15, 'raster-brightness-min': 0.04, 'raster-brightness-max': 0.96, 'raster-hue-rotate': -4, 'raster-fade-duration': 300 } },
      { id: 'roads', type: 'line', source: 'osm', 'source-layer': 'transportation', layout: { visibility: 'none' },
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'],
        paint: { 'line-color': 'rgba(255,255,255,.35)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 18, 6] } },
      { id: 'buildings', type: 'fill-extrusion', source: 'bld', 'source-layer': 'building', minzoom: 13, layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#f6efe3',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-vertical-gradient': true,
          'fill-extrusion-opacity': 0.95,
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
        layout: { 'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']], 'text-font': labelFont, 'text-size': 12, 'text-anchor': 'left', 'text-offset': [0.9, 0], 'text-optional': true },
        paint: { 'text-color': '#c2410c', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } },
      { id: 'places', type: 'symbol', source: 'osm', 'source-layer': 'place', maxzoom: 15,
        layout: { 'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']], 'text-font': labelFont, 'text-size': 14 },
        paint: { 'text-color': '#2d3b55', 'text-halo-color': '#fff', 'text-halo-width': 2 } },
    ],
  };
}
