#!/usr/bin/env python3
"""Tải DEM (Terrarium, nguồn SRTM/Mapzen trên AWS Open Data) cho vùng Cam Ranh
và đóng gói thành public/camranh-dem.pmtiles. Yêu cầu: pmtiles CLI (brew install pmtiles)."""
import math, os, sqlite3, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

W, S, E, N = (float(v) for v in os.environ.get("BOUNDS", "109.00,11.80,109.35,12.10").split(","))
MAXZ = int(os.environ.get("MAXZ", "13"))
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
mb, out = os.path.join(root, "data/dem.mbtiles"), os.path.join(root, "public/camranh-dem.pmtiles")
os.makedirs(os.path.dirname(mb), exist_ok=True)

def xy(lon, lat, z):
    n = 2 ** z
    return (int((lon + 180) / 360 * n),
            int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n))

tiles = []
for z in range(0, MAXZ + 1):
    x0, y1 = xy(W, S, z); x1, y0 = xy(E, N, z)
    tiles += [(z, x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
print(f"{len(tiles)} tile")

def fetch(t):
    z, x, y = t
    for _ in range(3):
        try:
            return t, urllib.request.urlopen(URL.format(z=z, x=x, y=y), timeout=30).read()
        except Exception as e:
            err = e
    sys.exit(f"lỗi tải {t}: {err}")

if os.path.exists(mb): os.remove(mb)
db = sqlite3.connect(mb)
db.executescript("create table metadata(name text,value text);"
                 "create table tiles(zoom_level int,tile_column int,tile_row int,tile_data blob);"
                 "create unique index ti on tiles(zoom_level,tile_column,tile_row);")
db.executemany("insert into metadata values(?,?)", [
    ("name", "camranh-dem"), ("format", "png"), ("type", "baselayer"),
    ("minzoom", "0"), ("maxzoom", str(MAXZ)), ("bounds", f"{W},{S},{E},{N}")])
with ThreadPoolExecutor(8) as ex:
    for (z, x, y), data in ex.map(fetch, tiles):
        db.execute("insert into tiles values(?,?,?,?)", (z, x, (2 ** z - 1) - y, data))
db.commit(); db.close()

if os.path.exists(out): os.remove(out)
subprocess.run(["pmtiles", "convert", mb, out], check=True)
print(os.path.getsize(out) // 1024, "KB ->", out)
