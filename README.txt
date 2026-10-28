MORACHI – AUTO SKU DẠNG SỐ THỨ TỰ (UAT)
========================================
Mục tiêu: SKU-MOR-0001, SKU-MOR-0002, SKU-MOR-0003... cấp cho từng phân loại (variant).
Không cần nhận diện brand, tên sản phẩm hay mã màu.

Quy tắc:
- 1 variant = 1 SKU, duy nhất trong container products.
- Các variant của cùng sản phẩm được cấp liên tiếp.
- Thứ tự được sắp xếp theo tên sản phẩm không dấu, rồi product ID và vị trí variant.
- SKU đã có KHÔNG thay đổi, kể cả SKU chữ từ các lần chạy trước.
- Nếu đã có SKU-MOR-0240 thì mã mới bắt đầu từ SKU-MOR-0241.
- Không đánh số lại khi sửa tên hay màu một sản phẩm đã lưu SKU.
- Chỉ thay đổi /variants/{index}/sku, không sửa stock, ảnh, giá bán, giá nhập.
- 3/85 sản phẩm không có variants[] sẽ không được cấp SKU tự động; cần kiểm tra riêng.

CÁCH CÀI:
1. Giải nén file morachi_auto_sku_numeric.py vào ~/MORACHI_SHOP/ (không ghi đè script v4).
2. Dùng Python môi trường có azure-cosmos (venv tại api/.venv hoặc .venv).

DRY RUN – KHÔNG GHI COSMOS DB:
 cd ~/MORACHI_SHOP
 python morachi_auto_sku_numeric.py --settings api/local.settings.json

Kết quả: sku_migration_reports/sku_preview_numeric_*.csv
Kiểm tra new_sku và cột approval: YES để duyệt; đổi NO nếu muốn bỏ qua dòng nào.
Nếu 240 variant chưa có SKU, kết quả từ SKU-MOR-0001 đến SKU-MOR-0240.

CHỈ SAU KHI XEM CSV VÀ XÁC NHẬN ACCOUNT UAT:
 python morachi_auto_sku_numeric.py --settings api/local.settings.json \
   --apply --reviewed-csv sku_migration_reports/sku_preview_numeric_<timestamp>.csv \
   --expect-account mrc-uat --confirm WRITE-TO-UAT

Không dùng CSV v4 mã chữ ở bước --apply: script này chỉ chấp nhận SKU-MOR-NNNN.
Không chạy đồng thời nhiều phiên script ghi SKU; Cosmos DB không có ràng buộc unique SKU xuyên các item.
Chạy lại DRY RUN sau khi ghi để xác minh số lượng SKU đã có.

BẢO MẬT:
- Chỉ cấu hình Cosmos DB tài khoản mrc-uat, không dùng production.
- api/local.settings.json chứa Key, không commit Git.
- Bổ sung sku_migration_reports/ vào .gitignore (chứa bản sao dữ liệu).
- Backup JSON là snapshot phục vụ phục hồi theo quy trình riêng, không phải hệ thống auto rollback.

SAMPLE (minh họa từ CSV MORACHI):
 CEZANNE Face Glow Color – 01 -> SKU-MOR-0001
 CEZANNE Face Glow Color – 02 -> SKU-MOR-0002
 CEZANNE Face Glow Color – 03 -> SKU-MOR-0003
 CANMAKE Perfect Multi Eyes – 03 -> SKU-MOR-0004
 CANMAKE Perfect Multi Eyes – 05 -> SKU-MOR-0005
