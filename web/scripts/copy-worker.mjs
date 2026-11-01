// MapLibre chạy tính toán bản đồ trong một Web Worker; chép file worker vào public/ để trình duyệt tải được.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/maplibre', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre/maplibre-gl-worker.mjs');
