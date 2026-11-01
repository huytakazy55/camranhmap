import type { Map as MLMap } from 'maplibre-gl';

export type Look = 'day' | 'dusk';
export type Mode = 'map' | 'sat';

export const LOOKS = {
  day: {
    sky: { 'sky-color': '#3f8fe6', 'horizon-color': '#d6ebff', 'fog-color': '#e3eef9', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.85, 'fog-ground-blend': 0.3 },
    light: { anchor: 'map', color: '#fff6e4', intensity: 0.38, position: [1.15, 215, 38] },
    raster: { 'raster-saturation': 0.3, 'raster-contrast': 0.15, 'raster-brightness-max': 0.96, 'raster-hue-rotate': -4 },
  },
  dusk: {
    sky: { 'sky-color': '#2c4f95', 'horizon-color': '#ffb77a', 'fog-color': '#f2b48a', 'sky-horizon-blend': 0.75, 'horizon-fog-blend': 0.9, 'fog-ground-blend': 0.55 },
    light: { anchor: 'map', color: '#ffd0a0', intensity: 0.42, position: [1.15, 255, 78] },
    raster: { 'raster-saturation': 0.38, 'raster-contrast': 0.2, 'raster-brightness-max': 0.88, 'raster-hue-rotate': 10 },
  },
} as const;

export function applyLook(map: MLMap, name: Look) {
  const L = LOOKS[name];
  map.setSky(L.sky);
  map.setLight({ ...L.light, position: [...L.light.position] });
  Object.entries(L.raster).forEach(([k, v]) => map.setPaintProperty('sat', k as never, v as never));
}

const MAP_LAYERS = ['m-sidewalk', 'm-road-center', 'm-landcover', 'm-park', 'm-water', 'm-waterway', 'm-road-casing', 'm-road', 'm-buildings'];
const SAT_LAYERS = ['sat', 'roads'];

export function applyMode(map: MLMap, mode: Mode, showBoxes: boolean) {
  const sat = mode === 'sat';
  MAP_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', sat ? 'none' : 'visible'));
  SAT_LAYERS.forEach((l) => map.setLayoutProperty(l, 'visibility', sat ? 'visible' : 'none'));
  map.setLayoutProperty('buildings', 'visibility', sat && showBoxes ? 'visible' : 'none');
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
}

export const heightExpr = (k: number) => ['*', k, ['coalesce', ['get', 'render_height'], 6]] as never;
