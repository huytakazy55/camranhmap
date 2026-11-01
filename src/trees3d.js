// Cây 3D thật (three.js custom layer, instancing) đặt tại vị trí cây từ bản đồ chiều cao tán Meta.
// Mô hình mặc định tạo bằng code (cây lá rộng + dừa). Muốn dùng model của bạn: bỏ file .glb vào
// public/models/ và khai báo trong public/models/trees.json, ví dụ: [{ "file": "tree1.glb", "weight": 2 }, { "file": "palm.glb", "weight": 1 }].
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MercatorCoordinate } from 'maplibre-gl';

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const paint = (g, hex) => {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
};
const flat = (g) => (g.index ? g.toNonIndexed() : g);

function blob(r, [x, y, z], hex, sy = 0.9) {
  let g = new THREE.IcosahedronGeometry(r, 1);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4); // đỉnh dùng chung -> bóng mượt, không nứt mặt
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const base = new THREE.Color(hex), top = base.clone().offsetHSL(0.01, 0.02, 0.13), t = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const k = 1 + (hash(p.getX(i) * 9, p.getY(i) * 9, p.getZ(i) * 9) - 0.5) * 0.2, py = p.getY(i) * k * sy;
    p.setXYZ(i, p.getX(i) * k, py, p.getZ(i) * k);
    t.copy(base).lerp(top, Math.min(1, Math.max(0, (py / r + 1) / 2))); col.set([t.r, t.g, t.b], i * 3); // sáng dần lên ngọn
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(x, y, z); g.computeVertexNormals(); return g;
}
function trunk(h, r0, r1, hex, bend = 0, seg = 1) {
  const g = new THREE.CylinderGeometry(r1, r0, h, 7, seg, true); g.translate(0, h / 2, 0);
  if (bend) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h; p.setX(i, p.getX(i) + bend * t * t); } }
  g.computeVertexNormals(); return paint(g, hex);
}

// Cây lá rộng, cao 1 đơn vị
export function broadleaf() {
  return mergeGeometries([
    trunk(0.45, 0.028, 0.018, '#6b4f35'),
    blob(0.30, [0, 0.62, 0], '#3f8a3a'), blob(0.22, [0.17, 0.5, 0.08], '#4a9a42'),
    blob(0.22, [-0.15, 0.52, -0.1], '#357a33'), blob(0.2, [0.03, 0.84, 0.02], '#58a84c'),
    blob(0.17, [0.1, 0.72, -0.15], '#4a9a42'), blob(0.16, [-0.12, 0.74, 0.14], '#3f8a3a')
  ]);
}
// Cây dừa: thân cong, tán lá rủ
export function palm() {
  const parts = [trunk(0.84, 0.03, 0.018, '#8a7358', 0.08, 5)];
  const frond = (ang, tint) => {
    const L = 0.34, seg = 6, pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, w = 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.004;
      const x = Math.cos(ang) * L * t, z = Math.sin(ang) * L * t, y = 0.84 + 0.11 * t - 0.2 * t * t;
      const nx = -Math.sin(ang) * w, nz = Math.cos(ang) * w;
      pos.push(x + 0.08 + nx, y, z + nz, x + 0.08 - nx, y, z - nz);
      if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals(); return paint(g, tint);
  };
  for (let i = 0; i < 9; i++) parts.push(frond((i / 9) * Math.PI * 2, i % 2 ? '#3f8a3a' : '#2f7a35'));
  parts.push(blob(0.035, [0.08, 0.83, 0], '#6b5b3a'));
  return mergeGeometries(parts);
}

// Trả về { models, fallback }: models = cây từ file .glb (đẹp, nặng, dùng cho cây gần camera),
// fallback = cây dựng bằng code (nhẹ, dùng cho cây xa hoặc khi không có file).
async function loadSpecies() {
  const fallback = [
    { geo: broadleaf(), weight: 0.8, width: [0.56, 0.77] },
    { geo: palm(), weight: 0.2, width: [0.42, 0.56] }
  ];
  const models = [];
  try { // public/models/trees.json = [{ "file": "tree1.glb", "weight": 1 }, ...]
    const r = await fetch('/models/trees.json'); if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0;
    for (const m of await r.json()) {
      const gltf = await new GLTFLoader().loadAsync('/models/' + m.file), geos = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const g = flat(o.geometry.clone()); g.applyMatrix4(o.matrixWorld);
        const col = (o.material.color || new THREE.Color('#4a9a42')).clone().offsetHSL(0, 0.08, 0.1); // model gốc khá tối
        paint(g, '#' + col.getHexString());
        geos.push(g);
      });
      if (!geos.length) continue;
      const g = mergeGeometries(geos); g.computeBoundingBox();
      const b = g.boundingBox, s = 1 / (b.max.y - b.min.y); // chuẩn hóa cao = 1, chân cây ở y = 0
      g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.scale(s, s, s);
      models.push({ geo: g, weight: m.weight ?? 1, width: m.width ?? [0.85, 1.2], glb: true });
    }
  } catch (e) { console.warn('Không nạp được model cây, dùng cây mặc định', e); models.length = 0; }
  return { models, fallback };
}

export async function initTrees3D(map, { minZoom = 16, radius = 700, max = 12000 } = {}) {
  const buf = await fetch('/camranh-trees.bin').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  if (!buf || buf.byteLength < 12) return;
  const data = new Float32Array(buf), count = data.length / 3;
  const cells = new Map(), CELL = 0.002;
  for (let i = 0; i < count; i++) { const k = `${Math.floor(data[i * 3] / CELL)},${Math.floor(data[i * 3 + 1] / CELL)}`; (cells.get(k) || cells.set(k, []).get(k)).push(i); }

  const { models, fallback } = await loadSpecies();
  const species = [...models, ...fallback]; // models trước, fallback sau
  const NEAR = 260, NEAR_MAX = 2200; // cây trong 260 m dùng model .glb (tối đa 2200 cây)
  const pick = (list, r) => { const t = list.reduce((a, q) => a + q.weight, 0); r *= t; let i = 0; while (i < list.length - 1 && (r -= list[i].weight) > 0) i++; return list[i]; };
  const scene = new THREE.Scene(), camera = new THREE.Camera(), root = new THREE.Group();
  root.matrixAutoUpdate = false; scene.add(root);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b7f5a', 1.55));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.5); sun.position.set(-0.6, 1, 0.8); sun.target.position.set(0, 0, 0); scene.add(sun);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const meshes = species.map((s) => { const m = new THREE.InstancedMesh(s.geo, mat, s.glb ? NEAR_MAX : max); m.count = 0; m.frustumCulled = false; root.add(m); return m; });
  let renderer, origin = null, pending = null, dirty = false, tries = 0, refine = false;
  const elevCache = new Map(); // idx cây -> độ cao đã đo được

  function rebuild() {
    if (map.getZoom() < minZoom) { meshes.forEach((m) => (m.count = 0)); map.triggerRepaint(); return; }
    const c = map.getCenter(), lat0 = c.lat * Math.PI / 180, KX = 111320 * Math.cos(lat0), KY = 110540;
    const dLon = radius / KX, dLat = radius / KY, mc = MercatorCoordinate.fromLngLat(c, 0), mpu = mc.meterInMercatorCoordinateUnits();
    origin = { mc, mpu, lon: c.lon ?? c.lng, lat: c.lat };
    root.matrix.copy(new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z)
      .multiply(new THREE.Matrix4().makeScale(mpu, -mpu, mpu)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    const n = new Array(species.length).fill(0), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), T = new THREE.Color();
    const ex = map.getTerrain()?.exaggeration ?? 1, zf = 1 + 0.6 * (ex - 1); // hiệu chỉnh thực nghiệm: custom layer lệch so với địa hình khi ex ≠ 1
    const clon = c.lng, centerUp = map.queryTerrainElevation(c); let missing = 0, glbCount = 0;
    for (let cx = Math.floor((clon - dLon) / CELL); cx <= Math.floor((clon + dLon) / CELL); cx++)
      for (let cy = Math.floor((c.lat - dLat) / CELL); cy <= Math.floor((c.lat + dLat) / CELL); cy++)
        for (const i of cells.get(`${cx},${cy}`) || []) {
          const lon = data[i * 3], lat = data[i * 3 + 1], h = data[i * 3 + 2];
          const e = (lon - clon) * KX, nn = (lat - c.lat) * KY;
          if (e * e + nn * nn > radius * radius) continue;
          const rnd = hash(lon * 1e4, lat * 1e4, 1);
          const useGlb = models.length && e * e + nn * nn < NEAR * NEAR && glbCount < NEAR_MAX;
          const sp = pick(useGlb ? models : fallback, rnd), s = species.indexOf(sp);
          if (n[s] >= (sp.glb ? NEAR_MAX : max)) continue;
          if (sp.glb) glbCount++;
          let up = map.queryTerrainElevation([lon, lat]);
          if (up == null) { missing++; up = elevCache.get(i) ?? centerUp ?? 0; } else elevCache.set(i, up);
          up *= zf;
          const w = sp.width[0] + (sp.width[1] - sp.width[0]) * hash(lon * 1e4, lat * 1e4, 2), hh = Math.min(h, 22);
          Q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(lon * 1e4, lat * 1e4, 3) * Math.PI * 2);
          M.compose(new THREE.Vector3(e, up, -nn), Q, new THREE.Vector3(hh * w, hh, hh * w)); // w: tỉ lệ ngang so với model chuẩn hóa cao = 1
          meshes[s].setMatrixAt(n[s], M);
          const v = hash(lon * 1e4, lat * 1e4, 4); meshes[s].setColorAt(n[s], T.setHSL(0, 0, 0.85 + v * 0.3)); n[s]++;
        }
    meshes.forEach((m, k) => { m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    dirty = missing > 0 && tries++ < 8; if (!dirty) tries = 0; // địa hình chưa tải xong -> xếp lại khi idle
    map.triggerRepaint();
  }
  const schedule = () => { clearTimeout(pending); refine = true; pending = setTimeout(rebuild, 250); };

  map.addLayer({
    id: 'trees3d', type: 'custom', renderingMode: '3d',
    onAdd(_m, gl) { renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true }); renderer.autoClear = false; },
    render(gl, args) {
      if (!origin) return;
      camera.projectionMatrix.fromArray(args.defaultProjectionData?.mainMatrix ?? args);
      renderer.resetState(); renderer.render(scene, camera);
    }
  }, 'road-names');

  map.on('moveend', schedule); map.on('zoomend', schedule); map.on('terrain', schedule);
  // Khi bản đồ idle = DEM chi tiết đã tải xong -> đo lại độ cao một lần cuối cho cây bám đúng mặt đất
  map.on('idle', () => { if (!origin || dirty || refine) { refine = false; rebuild(); } });
  map.once('idle', rebuild);
}
