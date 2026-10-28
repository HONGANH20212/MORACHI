# MORACHI Admin Unified v3 — bản sửa lỗi chuyển trang (UAT)

**Mục tiêu:** Giữ nguyên Admin như Production: sidebar bên trái luôn tồn tại, nội dung **Kho sản phẩm / Đơn đặt hàng / Đợt nhập / Kho SKU / Tạo đơn Offline / Nhập JPY / Doanh thu** thay đổi trong vùng nội dung của cùng một trang `http://localhost:4280/admin/`. Không bật tab, không nhảy sang `/admin/<module>.html`.

## Vì sao v1/v2 vẫn mở trang mới?

- v1 chèn link đến các file HTML độc lập, mỗi trang có sidebar/header riêng.
- v2 bổ sung UI nhúng nhưng có thể vẫn chịu ảnh hưởng JS v1 khi mã cũ chưa được gỡ hết hoặc bản cũ đang được cache; và không chuyển URL `.html` nhập trực tiếp về shell.
- v3 **thay toàn bộ menu bằng button không có href**, loại bỏ script portal v1 / unified v2, nhúng phần nghiệp vụ bên trong một iframe cùng origin, thêm redirect khi truy cập trực tiếp các URL công cụ cũ.
- iFrame chỉ là giải pháp tương thích nhanh để giữ nguyên các trang nghiệp vụ hiện có. Đây **chưa phải một SPA thật sự**: nếu cần thống nhất tuyệt đối từng modal, từng thành phần UI và điều hướng bên trong, cần tách JS/CSS từng module thành component riêng. Đổi tab giữa các module khác nhau có thể tải lại module.

## Cài trên UAT WSL

```bash
cd ~/MORACHI_SHOP
mkdir -p /tmp/morachi-unified-v3
unzip -o morachi_admin_unified_v3.zip -d /tmp/morachi-unified-v3
python3 /tmp/morachi-unified-v3/morachi_admin_unified_v3/install_unified_admin_v3.py ~/MORACHI_SHOP --check
python3 /tmp/morachi-unified-v3/morachi_admin_unified_v3/install_unified_admin_v3.py ~/MORACHI_SHOP
python3 /tmp/morachi-unified-v3/morachi_admin_unified_v3/verify_unified_v3.py ~/MORACHI_SHOP
```

Làm mới trang bằng `Ctrl+Shift+R` và mở **http://localhost:4280/admin/#offline** hoặc **http://localhost:4280/admin/#revenue**. Lúc bấm menu, đường dẫn phải luôn giữ `/admin/#<tên>`.

Nếu giao diện vẫn như cũ, kiểm tra từ terminal:

```bash
cd ~/MORACHI_SHOP
grep -n 'unified-v3.js\|data-mu3-page' admin/index.html | head -15
curl -s http://localhost:4280/admin/ | grep -o 'unified-v3.js[^" ]*' | head -1
```

Nếu grep file có v3 nhưng curl không thấy: SWA có thể đang chạy một thư mục khác hoặc trả trang cũ, hãy dừng `swa start` và chạy lại trong đúng `~/MORACHI_SHOP`.

## Nguyên tắc an toàn

- Chỉ chỉnh `admin/*.html` và thêm 3 file CSS/JS trong `admin/`; không sửa `function_app.py`, `api/*`, `cart.js`, `script.js`, `staticwebapp.config.json`, Cosmos DB.
- Cần `/admin*` yêu cầu role `morachiadmin`. Kiểm thử đăng nhập Microsoft thực ở Azure staging (localhost có giả lập role).
- Các tệp được sửa được sao lưu trước vào `~/MORACHI_SHOP/.morachi-backups/unified-admin-v3-<timestamp>/`.
- Không khắc phục lỗi API trả 0 sản phẩm hay vấn đề tồn kho. Đây là vấn đề riêng phải kiểm tra Azure Functions/Cosmos DB.
- Không tự deploy hoặc push Production.

## Rollback

Tìm thư mục backup vừa tạo:

```bash
ls -dt ~/MORACHI_SHOP/.morachi-backups/unified-admin-v3-* | head -1
```

Chép trả các file trong thư mục backup vào đường dẫn tương ứng thuộc `~/MORACHI_SHOP/` (lưu ý chỉ các file được thay đổi, không xóa dữ liệu); sau đó refresh. Các tài nguyên v3 bổ sung là `admin/unified-v3.js`, `admin/unified-v3.css`, `admin/embedded-v3.css`, có thể gỡ nếu không có trong backup.
