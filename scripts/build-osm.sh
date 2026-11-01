#!/usr/bin/env bash
# Tải OSM Việt Nam (Geofabrik) và cắt vùng Cam Ranh thành data/camranh.pmtiles
# (schema OpenMapTiles, tương thích style trong src/main.js).
# Yêu cầu: Docker. Dùng: ./scripts/build-osm.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data public

# west,south,east,north – Cam Ranh + Cam Lâm + bán đảo + Bãi Dài
BOUNDS="${BOUNDS:-109.00,11.80,109.35,12.10}"

docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx4g" -v "$PWD/data:/data" \
  ghcr.io/onthegomap/planetiler:latest \
  --download --area=vietnam --bounds="$BOUNDS" \
  --output=/data/camranh.pmtiles --force \
  --maxzoom=14

mv data/camranh.pmtiles public/camranh.pmtiles
ls -lh public/camranh.pmtiles
