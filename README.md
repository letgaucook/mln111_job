# Chuyến Tàu Tri Thức — Survival quiz

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm install` | Cài thư viện |
| `npm run dev` | Chạy client (Vite). Không có API → vẫn chơi được, nộp điểm báo lỗi và có nút "Thử nộp lại" |
| `vercel dev` | Chạy client + `api/leaderboard.ts` (cần Redis, xem dưới) |
| `npm test` | Test luật chơi (`shared/rules.test.ts`) |
| `npm run check-content` | Kiểm tra `content/stations.json` |
| `npm run images` | Chuyển ảnh gốc `art/*.png` → `public/images/*.webp` |
| `npm run build` | Typecheck + build ra `dist/` |

## Cấu hình bảng xếp hạng (Upstash Redis)

1. Vercel Dashboard → project → **Storage / Marketplace → Upstash Redis** → tạo database, kết nối vào project.
2. Kiểm tra biến môi trường đã được thêm: `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` hoặc `KV_REST_API_URL`/`KV_REST_API_TOKEN` (code đọc cả hai).
3. Chạy local: `vercel link` rồi `vercel env pull .env.development.local`, sau đó `vercel dev`.

Thiếu biến môi trường → API trả 503 "Máy chủ chưa cấu hình Redis".

## Nội dung

- `content/stations.json`: 10 ga (90 câu) + 5 câu boss, soạn từ `Tom_tat_Triet_hoc_Mac-Lenin_Chuong_1-3.pdf`. Ga 1–3: Chương 1; ga 4–8: Chương 2; ga 9–10: Chương 3. Sửa xong chạy `npm run check-content`.
- Khi đổi câu hỏi, **tăng `version`** để lượt chơi dở của người chơi được làm mới (tránh replay lệch nội dung).
- `content/guide.md` (Hướng dẫn) và `content/materials.md` (Tài liệu) là markdown tĩnh.
- Ảnh: ảnh gốc (PNG) để trong `art/`, rồi chạy `npm run images`. Script cắt vào khung cửa sổ, resize và xuất WebP ra `public/images/` (ảnh ga/boss 512px, ≤ 80 KB; ảnh OG 1200×630; ảnh nền `bg.webp` 1920×1080). Ảnh nền mặc định lấy từ `og.png`; muốn nền riêng thì thêm `art/bg.png` (ảnh ngang, tối, ít chi tiết ở giữa) rồi chạy lại lệnh. Ảnh `art/station-N.png` là ảnh của ga thứ N.
