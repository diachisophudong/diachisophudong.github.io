# SỐ HOÁ ĐỊA CHỈ NHÀ - Xã Phù Đổng

Trang web tĩnh tra cứu địa chỉ hộ gia đình xã Phù Đổng — phục vụ người dân tra cứu nhanh họ tên, năm sinh, thôn/xóm và đường dẫn Google Maps của từng hộ.

## Cách chạy

Không cần build. Chạy server tĩnh ở thư mục gốc (vì `fetch()` không hoạt động từ `file://`):

```
python -m http.server 8000
```

mở http://localhost:8000.

## Cấu trúc

- `index.html` — trang duy nhất (tiếng Việt)
- `css/styles.css` — toàn bộ style (mobile-first, breakpoints 768/480/360)
- `js/script.js` — tìm kiếm client-side trên `data/data.json` (≥3 ký tự, nhóm theo hộ, lọc năm sinh/xóm, bàn phím Enter/mũi tên/Esc)
- `img/` — ảnh giao diện (PNG có alpha)
- `data/data.json` — dữ liệu hộ gia đình

## Cập nhật dữ liệu

`data/data.json`: mỗi bản ghi `{family_id, address, person, person_dob, hamlet, village, commune, google_maps}`. Lưu ý file có BOM UTF-8 — trình duyệt đọc bình thường, script Node phải bỏ `\uFEFF` trước khi parse.
