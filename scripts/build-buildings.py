#!/usr/bin/env python3
"""Tải footprint nhà từ Overture Maps (Microsoft + Google + OSM) cho vùng Cam Ranh,
gán chiều cao ước lượng, đóng gói public/camranh-buildings.pmtiles.
Yêu cầu: pip install overturemaps ; brew install tippecanoe."""
import hashlib, json, os, subprocess, tempfile

BOUNDS = os.environ.get("BOUNDS", "109.00,11.80,109.35,12.10")
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = os.path.join(root, "public/camranh-buildings.pmtiles")
tmp = tempfile.mkdtemp()
raw, prepared = os.path.join(tmp, "raw.geojsonl"), os.path.join(tmp, "b.geojsonl")

subprocess.run(["overturemaps", "download", f"--bbox={BOUNDS}", "-f", "geojsonseq",
                "--type=building", "-o", raw], check=True)

def area_m2(ring):  # xấp xỉ, đủ để phân loại nhà nhỏ/lớn
    lat = ring[0][1]; kx, ky = 111320 * __import__("math").cos(__import__("math").radians(lat)), 110540
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(ring, ring[1:]))) / 2 * kx * ky

n = 0
with open(raw) as fin, open(prepared, "w") as fout:
    for line in fin:
        f = json.loads(line.lstrip("\x1e"))
        p, g = f["properties"], f["geometry"]
        if p.get("is_underground"): continue
        # Chiều cao: ưu tiên dữ liệu thật; không có thì ước lượng 1-3 tầng, nhà lớn cao hơn
        if p.get("height"): h = float(p["height"])
        elif p.get("num_floors"): h = float(p["num_floors"]) * 3.2
        else:
            ring = (g["coordinates"][0][0] if g["type"] == "MultiPolygon" else g["coordinates"][0])
            seed = int(hashlib.md5(json.dumps(f["id"] if "id" in f else ring[0]).encode()).hexdigest()[:6], 16)
            floors = 1 + seed % 3 + (2 if area_m2(ring) > 400 else 0)
            h = floors * 3.2 + 0.5
        fout.write(json.dumps({"type": "Feature", "geometry": g,
                               "properties": {"render_height": round(h, 1), "estimated": "height" not in p}}) + "\n")
        n += 1
print(n, "tòa nhà")

if os.path.exists(out): os.remove(out)
subprocess.run(["tippecanoe", "-o", out, "-l", "building", "-Z12", "-z15", "--no-tile-size-limit",
                "--drop-densest-as-needed", "--detect-shared-borders", "--generate-ids", "-f", prepared], check=True)
print(os.path.getsize(out) // 1024, "KB ->", out)
