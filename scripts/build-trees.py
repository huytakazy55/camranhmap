#!/usr/bin/env python3
"""Đặt cây theo dữ liệu thật: Meta High Resolution Canopy Height Map (1 m, dựng từ ảnh vệ tinh,
CC-BY 4.0, AWS Open Data). Tìm đỉnh tán cây trong CHM, lấy chiều cao thật, bỏ cây đè lên nhà,
chỉ giữ khu dân cư. Đóng gói public/camranh-trees.pmtiles (lớp shadow, trunk, canopy).
Yêu cầu: overturemaps, tippecanoe, rasterio, numpy, scipy. CHM đặt ở data/chm/{quadkey}.tif"""
import colorsys, hashlib, json, math, os, subprocess, tempfile, urllib.request
import numpy as np, rasterio
from rasterio import features
from rasterio.warp import transform, transform_bounds
from rasterio.windows import Window, from_bounds
from scipy import ndimage
from scipy.ndimage import gaussian_filter, maximum_filter

BOUNDS = [float(v) for v in os.environ.get("BOUNDS", "109.00,11.80,109.35,12.10").split(",")]
W, S, E, N = BOUNDS
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
chm_dir, out = os.path.join(root, "data/chm"), os.path.join(root, "public/camranh-trees.pmtiles")
BASE = "https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/"
tmp = tempfile.mkdtemp()

def quadkey(x, y, z):
    return "".join(str((1 if x & (1 << i - 1) else 0) + (2 if y & (1 << i - 1) else 0)) for i in range(z, 0, -1))
def tile(lon, lat, z=9):
    n = 2 ** z; return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
x0, y1 = tile(W, S); x1, y0 = tile(E, N)
tifs = []
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        p = os.path.join(chm_dir, quadkey(x, y, 9) + ".tif"); os.makedirs(chm_dir, exist_ok=True)
        if not os.path.exists(p): urllib.request.urlretrieve(BASE + os.path.basename(p), p)
        tifs.append(p)

# nhà (để loại cây trên nóc nhà + chỉ giữ khu dân cư)
bfile = os.path.join(tmp, "bld.jsonl")
subprocess.run(["overturemaps", "download", f"--bbox={BOUNDS and ','.join(map(str, BOUNDS))}", "-f", "geojsonseq", "--type=building", "-o", bfile], check=True, capture_output=True)
buildings, grid = [], {}
KX, KY = 111320 * math.cos(math.radians((S + N) / 2)), 110540
for l in open(bfile):
    g = json.loads(l.lstrip("\x1e"))["geometry"]; buildings.append(g)
    ring = g["coordinates"][0][0] if g["type"] == "MultiPolygon" else g["coordinates"][0]
    k = (int(ring[0][0] * KX // 60), int(ring[0][1] * KY // 60)); grid[k] = grid.get(k, 0) + 1
def urban(lon, lat):  # >= 4 nhà trong ~180 m xung quanh
    cx, cy = int(lon * KX // 60), int(lat * KY // 60)
    return sum(grid.get((cx + i, cy + j), 0) for i in (-1, 0, 1) for j in (-1, 0, 1)) >= 4

def ring_poly(lon, lat, r, n=10):
    pts = [[lon + r * math.cos(2 * math.pi * a / n) / KX, lat + r * math.sin(2 * math.pi * a / n) / KY] for a in range(n)]
    pts.append(pts[0]); return {"type": "Polygon", "coordinates": [pts]}

RAD = [0.62, 0.92, 1.0, 0.82, 0.48]        # hình quả cầu: 5 tầng tán
fs, ft, fc = (open(os.path.join(tmp, n + ".jsonl"), "w") for n in ("shadow", "trunk", "canopy"))
CH, PAD, total = 2048, 24, 0
pts = []  # lon, lat, cao (m) từng cây -> dùng cho lớp cây 3D (three.js)
for tif in tifs:
    with rasterio.open(tif) as d:
        bb = transform_bounds("EPSG:4326", d.crs, W, S, E, N)
        win = from_bounds(*bb, transform=d.transform).round_offsets().round_lengths()
        win = win.intersection(Window(0, 0, d.width, d.height)) if win.width > 0 and win.height > 0 else None
        if win is None: continue
        for r0 in range(int(win.row_off), int(win.row_off + win.height), CH):
            for c0 in range(int(win.col_off), int(win.col_off + win.width), CH):
                rr0, cc0 = max(r0 - PAD, 0), max(c0 - PAD, 0)
                w = Window(cc0, rr0, min(CH + 2 * PAD, d.width - cc0), min(CH + 2 * PAD, d.height - rr0))
                cb = d.window_transform(w) * (0, 0), d.window_transform(w) * (w.width, w.height)
                lo, la = transform(d.crs, "EPSG:4326", [cb[0][0], cb[1][0]], [cb[0][1], cb[1][1]])
                if not any(urban(lo[0] + (lo[1] - lo[0]) * i / 4, la[1] + (la[0] - la[1]) * j / 4) for i in range(5) for j in range(5)): continue
                a = d.read(1, window=w).astype("float32")
                if a.max() < 3: continue
                sm = gaussian_filter(a, 1.0)
                pk = (sm == maximum_filter(sm, size=5)) & (sm >= 3)
                # loại cây trên nóc nhà
                tr = d.window_transform(w)
                geoms = []
                for g in buildings:
                    ring = g["coordinates"][0][0] if g["type"] == "MultiPolygon" else g["coordinates"][0]
                    if lo[0] <= ring[0][0] <= lo[1] and la[1] <= ring[0][1] <= la[0]: geoms.append(g)
                if geoms:
                    from rasterio.warp import transform_geom
                    geoms = [transform_geom("EPSG:4326", d.crs, g) for g in geoms]
                    pk &= ~features.rasterize(geoms, out_shape=a.shape, transform=tr, fill=0, default_value=1, all_touched=True).astype(bool)
                # Gộp các pixel đỉnh liền kề (vùng tán phẳng) thành 1 cây; cụm lớn thì rải cây cách nhau ~7 m
                lab, nlab = ndimage.label(pk, structure=np.ones((3, 3)))
                if nlab == 0: continue
                ids = np.arange(1, nlab + 1); sizes = np.bincount(lab.ravel(), minlength=nlab + 1)
                com = np.array(ndimage.center_of_mass(pk, lab, ids)).reshape(-1, 2)
                big = sizes[1:] > 25
                rows, cols = com[~big, 0], com[~big, 1]
                if big.any():
                    r2, c2 = np.nonzero(pk & big[np.clip(lab - 1, 0, None)] & (lab > 0) & (np.arange(a.shape[0])[:, None] % 6 == 3) & (np.arange(a.shape[1])[None, :] % 6 == 3))
                    rows, cols = np.concatenate([rows, r2.astype(float)]), np.concatenate([cols, c2.astype(float)])
                core = (rows + rr0 >= r0) & (rows + rr0 < r0 + CH) & (cols + cc0 >= c0) & (cols + cc0 < c0 + CH)
                rows, cols = rows[core], cols[core]
                if not len(rows): continue
                xs, ys = rasterio.transform.xy(tr, rows, cols, offset="center")
                lons, lats = transform(d.crs, "EPSG:4326", xs, ys)
                for lon, lat, h in zip(lons, lats, sm[np.round(rows).astype(int).clip(0, a.shape[0] - 1), np.round(cols).astype(int).clip(0, a.shape[1] - 1)]):
                    if not (W <= lon <= E and S <= lat <= N) or not urban(lon, lat): continue
                    seed = int(hashlib.md5(f"{lon:.6f},{lat:.6f}".encode()).hexdigest()[:8], 16)
                    v = (seed % 1000) / 1000; h = float(h); rad = min(5.5, 1.3 + 0.24 * h)
                    th = max(1.2, 0.28 * h); span = h - th; hue = 0.25 + 0.06 * (v - .5); sat = 0.45 + 0.2 * v
                    fs.write(json.dumps({"type": "Feature", "properties": {}, "geometry": ring_poly(lon, lat, rad * 1.05)}) + "\n")
                    ft.write(json.dumps({"type": "Feature", "properties": {"h": round(th, 1)}, "geometry": ring_poly(lon, lat, 0.22, 6)}) + "\n")
                    for i, k in enumerate(RAD):
                        col = "#%02x%02x%02x" % tuple(int(c * 255) for c in colorsys.hls_to_rgb(hue, 0.20 + 0.07 * i + 0.05 * v, sat))
                        fc.write(json.dumps({"type": "Feature", "properties": {"b": round(th + span * i / 5, 1), "t": round(th + span * (i + 1) / 5, 1), "c": col},
                                             "geometry": ring_poly(lon, lat, rad * k)}) + "\n")
                    pts += [lon, lat, h]
                    total += 1
for f in (fs, ft, fc): f.close()
print(total, "cây")
np.asarray(pts, dtype="<f4").tofile(os.path.join(root, "public/camranh-trees.bin"))
if os.path.exists(out): os.remove(out)
subprocess.run(["tippecanoe", "-o", out, "-Z15", "-z16", "--no-tile-size-limit", "--no-feature-limit", "-f",
                "-L", f"shadow:{tmp}/shadow.jsonl", "-L", f"trunk:{tmp}/trunk.jsonl", "-L", f"canopy:{tmp}/canopy.jsonl"], check=True, capture_output=True)
print(os.path.getsize(out) // 2 ** 20, "MB ->", out)
