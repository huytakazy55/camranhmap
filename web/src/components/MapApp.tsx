'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeoJSONSource, Map as MLMap, Marker } from 'maplibre-gl';
import labels from '@/data/labels.json';
import type { Property } from '@/lib/types';
import { formatArea, formatPrice, formatTel, propertyPath } from '@/lib/format';
import { buildStyle } from '@/lib/map/style';
import { applyLook, applyMode, heightExpr, type Look, type Mode } from '@/lib/map/looks';
import { initDraw } from '@/lib/map/draw';
import PropertyEditor from './PropertyEditor';

type MapLibre = typeof import('maplibre-gl');
type Props = { properties: Property[]; initialSlug?: string; admin?: boolean };

const CENTER: [number, number] = [109.159, 11.92]; // Cam Ranh
const ALL = 'Tất cả';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const PRESETS = [[0, 'Từ trên xuống'], [45, 'Xiên 45°'], [70, 'Bay thấp'], [85, 'Tầm mắt']] as const;

let configured = false;

export default function MapApp({ properties, initialSlug, admin = false }: Props) {
  const router = useRouter();
  const initial = useMemo(() => properties.find((p) => p.slug === initialSlug) ?? null, [properties, initialSlug]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mlRef = useRef<MapLibre | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const orbitRef = useRef<number | null>(null);
  const skipFlyRef = useRef(!!initial);
  const flownIdRef = useRef<string | null>(null);
  const baseTitleRef = useRef('');
  const drawRef = useRef<ReturnType<typeof initDraw> | null>(null);

  const [map, setMap] = useState<MLMap | null>(null);
  const [filter, setFilter] = useState(ALL);
  const [editing, setEditing] = useState<Property | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initial?.id ?? null);
  const [mode, setMode] = useState<Mode>('map');
  const [look, setLook] = useState<Look>('day');
  const [showBoxes, setShowBoxes] = useState(false);
  const [clean, setClean] = useState(false);
  const [pitch, setPitch] = useState(initial ? 65 : 60);
  const [bearing, setBearing] = useState(-20);
  const [bh, setBh] = useState(1);
  const [th, setTh] = useState(1);

  const active = useMemo(() => properties.find((p) => p.id === activeId) ?? null, [properties, activeId]);
  const types = useMemo(() => [ALL, ...new Set(properties.map((p) => p.type))], [properties]);
  const shown = useMemo(() => properties.filter((p) => filter === ALL || p.type === filter), [properties, filter]);

  const stopOrbit = useCallback(() => {
    if (orbitRef.current) cancelAnimationFrame(orbitRef.current);
    orbitRef.current = null;
  }, []);

  const select = useCallback((id: string | null) => {
    stopOrbit();
    setActiveId(id);
    if (admin) return;
    const p = properties.find((x) => x.id === id);
    const path = p ? propertyPath(p.slug) : '/';
    window.history.replaceState(window.history.state, '', path + window.location.hash);
    document.title = p ? `${p.title} | Cam Ranh 3D` : baseTitleRef.current;
  }, [properties, stopOrbit, admin]);
  const selectRef = useRef(select);
  selectRef.current = select;

  // --- khởi tạo bản đồ (một lần) ---
  useEffect(() => {
    baseTitleRef.current = document.title;
    let disposed = false;
    let created: MLMap | null = null;

    (async () => {
      const [ml, { Protocol }] = await Promise.all([import('maplibre-gl'), import('pmtiles')]);
      if (disposed || !containerRef.current) return;
      mlRef.current = ml;
      if (!configured) {
        ml.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
        ml.addProtocol('pmtiles', new Protocol().tile);
        configured = true;
      }

      const m = new ml.Map({
        container: containerRef.current,
        style: buildStyle(window.location.origin),
        center: initial ? [initial.lng, initial.lat] : CENTER,
        zoom: initial ? 17.2 : 12,
        pitch: initial ? 65 : 60,
        bearing: -20,
        maxPitch: 85,
        maxZoom: 19.5,
        hash: true,
      });
      created = m;
      if (process.env.NODE_ENV !== 'production') (window as unknown as { map: MLMap }).map = m;
      m.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-right');
      m.addControl(new ml.ScaleControl());

      // Nhãn nổi kiểu quảng cáo (src/data/labels.json)
      const callouts = labels.map((l) => {
        const el = Object.assign(document.createElement('div'), { className: 'callout', textContent: l.text });
        new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat]).addTo(m);
        return { el, l };
      });
      const syncCallouts = () => { const z = m.getZoom(); callouts.forEach(({ el, l }) => el.classList.toggle('off', z < l.minZoom || z > l.maxZoom)); };
      m.on('zoom', syncCallouts); syncCallouts();

      // Đồng bộ thanh trượt khi người dùng kéo chuột phải / dùng phím
      m.on('pitch', () => setPitch(Math.round(m.getPitch())));
      m.on('rotate', () => setBearing(Math.round(m.getBearing())));
      setPitch(Math.round(m.getPitch())); setBearing(Math.round(m.getBearing()));

      m.on('load', () => {
        if (disposed) return;
        drawRef.current = initDraw(m, {
          stopOrbit: () => { if (orbitRef.current) cancelAnimationFrame(orbitRef.current); orbitRef.current = null; },
          closeDetail: () => selectRef.current(null),
        });
        setMap(m);
      });
    })();

    return () => {
      disposed = true;
      stopOrbit();
      drawRef.current?.dispose();
      drawRef.current = null;
      markersRef.current.clear();
      created?.remove();
      mlRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- chế độ, ánh sáng, độ cao ---
  useEffect(() => { if (map) applyMode(map, mode, showBoxes); }, [map, mode, showBoxes]);
  useEffect(() => { if (map) applyLook(map, look); }, [map, look]);
  useEffect(() => {
    if (map) ['m-buildings', 'buildings'].forEach((l) => map.setPaintProperty(l, 'fill-extrusion-height', heightExpr(bh)));
  }, [map, bh]);
  useEffect(() => { if (map) map.setTerrain({ source: 'dem', exaggeration: th }); }, [map, th]);

  // --- ghim giá ---
  useEffect(() => {
    const ml = mlRef.current;
    if (!map || !ml) return;
    const made = markersRef.current;
    properties.forEach((p) => {
      const el = Object.assign(document.createElement('div'), { className: 'pin', textContent: formatPrice(p.priceVnd) });
      el.onclick = (e) => { e.stopPropagation(); selectRef.current(p.id); };
      made.set(p.id, new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map));
    });
    return () => { made.forEach((m) => m.remove()); made.clear(); };
  }, [map, properties]);
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const el = m.getElement();
      el.style.display = shown.some((p) => p.id === id) ? '' : 'none';
      el.classList.toggle('on', id === activeId);
    });
  }, [map, shown, activeId]);

  // --- chọn bất động sản: tô lô đất + bay tới ---
  useEffect(() => {
    if (!map) return;
    const src = map.getSource('parcels') as GeoJSONSource;
    if (!active) { src.setData(EMPTY); flownIdRef.current = null; return; }
    src.setData({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...active.polygon, active.polygon[0]]] } }],
    });
    if (skipFlyRef.current) { skipFlyRef.current = false; flownIdRef.current = active.id; return; }
    if (flownIdRef.current === active.id) return; // vừa sửa tin đang xem: giữ nguyên góc nhìn
    flownIdRef.current = active.id;
    map.flyTo({ center: [active.lng, active.lat], zoom: 17.2, pitch: 65, bearing: map.getBearing() + 40, duration: 3500, essential: true });
  }, [map, active]);

  // --- ẩn giao diện ---
  useEffect(() => {
    document.body.classList.toggle('clean', clean);
    return () => document.body.classList.remove('clean');
  }, [clean]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.body.classList.contains('clean')) { stopOrbit(); setClean(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stopOrbit]);

  // --- xoay quanh / quay phim ---
  function startOrbit(speed = 0.25) {
    if (!map || !active) return;
    stopOrbit();
    map.easeTo({ center: [active.lng, active.lat], zoom: 17.5, pitch: 68, duration: 800 });
    const tick = () => { map.setBearing(map.getBearing() + speed); orbitRef.current = requestAnimationFrame(tick); };
    orbitRef.current = requestAnimationFrame(tick);
    map.once('mousedown', stopOrbit); map.once('touchstart', stopOrbit);
  }

  async function removeActive() {
    if (!active || !window.confirm(`Xóa "${active.title}"? Không khôi phục được.`)) return;
    const res = await fetch(`/api/admin/properties/${encodeURIComponent(active.slug)}`, { method: 'DELETE' });
    if (res.status === 401) { window.location.href = '/admin/login'; return; }
    if (!res.ok) { window.alert(`Xóa thất bại (${res.status}).`); return; }
    select(null);
    router.refresh();
  }

  function cinematic() {
    const p = active ?? properties[0];
    if (!map || !p) return;
    stopOrbit();
    setClean(true);
    const stop = () => { stopOrbit(); setClean(false); map.off('mousedown', stop); map.off('touchstart', stop); map.off('wheel', stop); };
    map.flyTo({ center: [p.lng, p.lat], zoom: 17.4, pitch: 70, bearing: -35, duration: 4500, essential: true });
    map.once('moveend', () => {
      const t0 = performance.now(), z0 = map.getZoom();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        map.jumpTo({ bearing: -35 + t * 4, zoom: Math.min(18.2, z0 + t * 0.015), pitch: Math.max(58, 70 - t * 0.3) });
        orbitRef.current = requestAnimationFrame(tick);
      };
      orbitRef.current = requestAnimationFrame(tick);
      map.on('mousedown', stop); map.on('touchstart', stop); map.on('wheel', stop);
    });
  }

  const Brand = initialSlug ? 'p' : 'h1';
  const Title = initialSlug ? 'h1' : 'h2';

  return (
    <>
      <div id="map" ref={containerRef} />

      <aside id="list">
        <Brand className="brand">Cam Ranh <span>3D</span></Brand>
        <p className="sub">Bất động sản trên bản đồ</p>
        {admin && (
          <>
            <PropertyEditor
              map={map}
              types={types}
              editing={editing}
              beforeStart={(closeDetail) => { stopOrbit(); if (closeDetail) select(null); drawRef.current?.cancel(); }}
              onSaved={(p) => { setFilter(ALL); setActiveId(p.id); router.refresh(); }}
              onEditEnd={() => setEditing(null)}
            />
            <button className="ghost logout" onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); window.location.href = '/admin/login'; }}>Đăng xuất</button>
          </>
        )}
        <div id="filters">
          {types.map((t) => (
            <button key={t} className={t === filter ? 'on' : ''} onClick={() => setFilter(t)}>{t}</button>
          ))}
        </div>
        <ul id="items">
          {shown.map((p) => (
            <li key={p.id}>
              <a href={propertyPath(p.slug)} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); select(p.id); }}>
                <b>{p.title}</b>
                <small>{formatPrice(p.priceVnd)} · {formatArea(p.areaM2)}</small>
              </a>
            </li>
          ))}
        </ul>
      </aside>

      {active && (
        <section id="detail">
          <button id="close" aria-label="Đóng" onClick={() => select(null)}>×</button>
          {active.image && <img src={active.image} alt={active.title} />}
          <div className="body">
            <span className="tag">{active.type}</span>
            <Title>{active.title}</Title>
            <div id="d-price">{formatPrice(active.priceVnd)} · {formatArea(active.areaM2)}</div>
            <dl>
              {active.info.map((i) => (<div key={i.label} style={{ display: 'contents' }}><dt>{i.label}</dt><dd>{i.value}</dd></div>))}
            </dl>
            <p>{active.desc}</p>
            <a className="cta" href={`tel:${active.phone}`}>Liên hệ {formatTel(active.phone)}</a>
            <button className="ghost" onClick={() => startOrbit()}>Xoay 360° quanh vị trí</button>
            {admin && (
              <div className="admin-actions">
                <button className="ghost" onClick={() => setEditing(active)}>✏️ Sửa</button>
                <button className="ghost danger" onClick={() => removeActive()}>🗑 Xóa</button>
              </div>
            )}
          </div>
        </section>
      )}

      <section id="view">
        <h3>Góc nhìn 3D</h3>
        <div className="presets">
          {PRESETS.map(([deg, text]) => (
            <button key={deg} className={Math.abs(deg - pitch) < 3 ? 'on' : ''}
              onClick={() => { stopOrbit(); map?.easeTo({ pitch: deg, duration: 900 }); }}>{text}</button>
          ))}
        </div>
        <div className="presets looks">
          <button className={look === 'day' ? 'on' : ''} onClick={() => setLook('day')}>☀️ Ban ngày</button>
          <button className={look === 'dusk' ? 'on' : ''} onClick={() => setLook('dusk')}>🌇 Hoàng hôn</button>
          <button className="wide" onClick={cinematic}>▶ Quay phim quảng cáo</button>
          <button className={`wide${showBoxes ? ' on' : ''}`} onClick={() => setShowBoxes((v) => !v)}>
            Khối nhà 3D trên ảnh vệ tinh: {showBoxes ? 'Bật' : 'Tắt'}
          </button>
          <button className="wide" onClick={() => setClean(true)}>Ẩn giao diện</button>
        </div>
        <label>Độ nghiêng <output>{pitch}°</output>
          <input type="range" min={0} max={85} step={1} value={pitch}
            onChange={(e) => { stopOrbit(); map?.setPitch(+e.target.value); }} /></label>
        <label>Hướng nhìn <output>{bearing}°</output>
          <input type="range" min={-180} max={180} step={1} value={bearing}
            onChange={(e) => { stopOrbit(); map?.setBearing(+e.target.value); }} /></label>
        <label>Độ cao nhà <output>×{bh}</output>
          <input type="range" min={1} max={4} step={0.25} value={bh} onChange={(e) => setBh(+e.target.value)} /></label>
        <label>Độ cao địa hình <output>×{th}</output>
          <input type="range" min={0} max={4} step={0.25} value={th} onChange={(e) => setTh(+e.target.value)} /></label>
      </section>

      <button id="show-ui" hidden={!clean} onClick={() => { stopOrbit(); setClean(false); }}>Hiện giao diện</button>

      <div id="tools">
        <button className={mode === 'sat' ? 'on' : ''} onClick={() => setMode('sat')}>Vệ tinh</button>
        <button className={mode === 'map' ? 'on' : ''} onClick={() => setMode('map')}>Bản đồ</button>
      </div>
    </>
  );
}
