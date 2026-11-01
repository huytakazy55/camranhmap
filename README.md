# Cam Ranh 3D

Bản đồ 3D bất động sản khu Cam Ranh.

```
web/      Next.js 16 (App Router, TypeScript) + MapLibre GL  — giao diện, SSR cho SEO
api/      ASP.NET Core (.NET 10) minimal API                 — dữ liệu bất động sản
deploy/   nginx.conf                                         — cổng vào, phục vụ file .pmtiles
src/ ...  Bản Vite cũ (chạy độc lập, có thể xóa khi không cần so sánh)
```

## Chạy bằng Docker

```bash
cp web/.env.example .env      # điền NEXT_PUBLIC_ARCGIS_API_KEY và ADMIN_PASSWORD (không dán vào chat/commit)
docker compose up -d --build
```

Mở http://localhost:8080. Dừng: `docker compose down`.

- `web/public/tiles/*.pmtiles` được nginx phục vụ (mount vào container), không nằm trong image. Lên máy chủ phải chép thư mục này theo.
- Biến `NEXT_PUBLIC_*` gắn vào mã lúc **build** (đổi giá trị thì `docker compose up -d --build`). Khóa nằm trong mã trình duyệt, nên phải giới hạn khóa Esri theo tên miền.
- Không đẩy image `web` lên registry công khai: khóa nằm trong image.

## Chạy khi phát triển

```bash
docker compose up -d api       # API tại http://localhost:5080
cd web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
```

## Thêm bất động sản (quản trị)

1. Đặt `ADMIN_PASSWORD` (chuỗi dài, ngẫu nhiên: `openssl rand -base64 18`) trong `.env`, rồi `docker compose up -d --build`.
2. Vào `/admin`, đăng nhập.
3. Bấm **＋ Thêm bất động sản**, bấm từng góc khu đất trên bản đồ 3D. Bấm lại điểm đầu hoặc Enter để chốt, Backspace lùi một điểm, Esc hủy. Cạnh cắt nhau sẽ bị chặn.
4. Điền biểu mẫu (diện tích tự tính từ ranh đất, có thể sửa) rồi lưu. Tin mới có trang riêng `/bat-dong-san/{slug}` và nằm trong sitemap.

**Sửa / xóa:** ở `/admin`, chọn một tin (trong danh sách hoặc bấm ghim giá) rồi bấm **✏️ Sửa** (đổi thông tin; **Vẽ lại ranh đất** để chấm lại các góc, Esc để quay về biểu mẫu) hoặc **🗑 Xóa** (có hỏi xác nhận, không khôi phục được). Khi sửa, slug và địa chỉ trang giữ nguyên để link đã chia sẻ không gãy.

Bảo mật: trang `/admin` và việc ghi dữ liệu đều cần mật khẩu; khóa chỉ nằm ở máy chủ Next, trình duyệt không thấy. Không đặt `ADMIN_PASSWORD` thì khu quản trị và việc ghi bị tắt hẳn.
Dữ liệu lưu ở volume Docker `api-data` (`/data/properties.json`), còn nguyên khi khởi động lại; **nhớ sao lưu volume này**. 

## SEO

- `/` và `/bat-dong-san/{slug}` được render sẵn ở máy chủ: có `<title>`, mô tả, canonical, Open Graph, JSON-LD (`RealEstateListing`), liên kết thật trong danh sách.
- `/sitemap.xml` lấy từ API; `/robots.txt`.
- **Mặc định noindex toàn site** (dữ liệu hiện là dữ liệu mẫu). Khi chạy thật: đặt `ALLOW_INDEXING=true` và `SITE_URL=https://ten-mien-cua-ban`.

## API

| Method | Đường dẫn | |
|---|---|---|
| GET | `/api/properties?type=` | Danh sách |
| GET | `/api/properties/{slug}` | Chi tiết (404 nếu không có) |
| POST | `/api/properties` | Thêm tin (cần header `X-Admin-Key`; web gọi qua `/api/admin/properties`) |
| PUT | `/api/properties/{slug}` | Sửa tin (cùng điều kiện; giữ id, slug) |
| DELETE | `/api/properties/{slug}` | Xóa tin (cùng điều kiện) |
| GET | `/healthz` | Kiểm tra sống |

Lần chạy đầu, dữ liệu được nạp từ `api/CamRanh.Api/Data/properties.seed.json` (3 tin mẫu) rồi ghi ra file dữ liệu. Khi cần tìm kiếm phức tạp hoặc nhiều người cùng sửa: cài đặt lại `IPropertyRepository` bằng EF Core + PostgreSQL.
