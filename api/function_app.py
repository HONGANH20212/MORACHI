import os
import json
import uuid
import mimetypes
from datetime import datetime
from email.parser import BytesParser
from email.policy import default

import azure.functions as func
from azure.cosmos import CosmosClient
from azure.storage.blob import BlobServiceClient, ContentSettings

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- CẤU HÌNH KẾT NỐI (Lấy từ Environment Variables của Azure) ---
COSMOS_URL = os.environ.get("COSMOS_URL")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DB_NAME = os.environ.get("COSMOS_DB_NAME", "morachi-db")
COSMOS_CONTAINER_NAME = os.environ.get("COSMOS_CONTAINER_NAME", "products")

BLOB_CONNECTION_STRING = os.environ.get("BLOB_CONNECTION_STRING")
BLOB_CONTAINER_NAME = os.environ.get("BLOB_CONTAINER_NAME", "products")

# --- HÀM TRỢ GIÚP (HELPER FUNCTIONS) ---

def cors_headers():
    """Tạo headers cho phép truy cập từ trình duyệt (CORS)"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def json_response(data, status_code=200):
    """Trả về dữ liệu dạng JSON chuẩn"""
    return func.HttpResponse(
        json.dumps(data, ensure_ascii=False),
        mimetype="application/json",
        status_code=status_code,
        headers=cors_headers()
    )

def options_response():
    """Xử lý yêu cầu OPTIONS của trình duyệt"""
    return func.HttpResponse(status_code=200, headers=cors_headers())

def get_cosmos_container():
    """Khởi tạo kết nối tới cơ sở dữ liệu Cosmos DB"""
    if not COSMOS_URL or not COSMOS_KEY:
        raise ValueError("Thiếu cấu hình Azure Cosmos DB trong ứng dụng.")
    client = CosmosClient(COSMOS_URL, credential=COSMOS_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    return database.get_container_client(COSMOS_CONTAINER_NAME)

def get_blob_container_client():
    """Khởi tạo kết nối tới Azure Blob Storage để lưu ảnh"""
    if not BLOB_CONNECTION_STRING:
        raise ValueError("Thiếu cấu hình Azure Blob Storage.")
    blob_service_client = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    return blob_service_client.get_container_client(BLOB_CONTAINER_NAME)

def to_display_order(value, default=999999):
    """Chuẩn hóa thứ tự hiển thị sản phẩm. Số nhỏ sẽ hiển thị trước."""
    try:
        number = int(float(value))
        return number if number > 0 else default
    except (TypeError, ValueError):
        return default

def to_sort_timestamp(value):
    """Chuyển created_at/updated_at sang timestamp để sort phụ, lỗi thì trả 0."""
    try:
        if not value:
            return 0
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0

def normalize_product(data, existing=None):
    """Chuẩn hóa dữ liệu sản phẩm, hỗ trợ xóa rỗng dữ liệu tùy chọn"""
    existing = existing or {}
    
    def get_field(key, default_val=""):
        # Nếu Admin có gửi lên (ngay cả khi gửi lên chuỗi rỗng ""), thì lấy giá trị đó
        if key in data:
            val = data[key]
            return str(val).strip() if val is not None else ""
        # Nếu không gửi lên, thì mới lấy lại đồ cũ trong database
        return str(existing.get(key, default_val)).strip()

    # Các trường bắt buộc (Không cho phép lưu rỗng)
    title = str(data.get("title", "")).strip() or existing.get("title", "")
    brand = str(data.get("brand", "")).strip() or existing.get("brand", "")
    current_price = str(data.get("current_price", "")).strip() or existing.get("current_price", "")

    return {
        "title": title.strip() if title else "",
        "brand": brand.strip() if brand else "",
        "current_price": current_price.strip() if current_price else "",
        "thumbnail": get_field("thumbnail"),
        "old_price": get_field("old_price"),
        "discount": get_field("discount"), # Giờ đây nếu admin xóa trắng, nó sẽ lưu rỗng thay vì giữ data cũ
        "rating": get_field("rating", "4.9"),
        "sold_text": get_field("sold_text", "1k/tháng"),
        "description": get_field("description"),
        "specifications": get_field("specifications"),
        "ingredients": get_field("ingredients"),
        "usage_manual": get_field("usage_manual"),
        "status": get_field("status", "active"),
        "variants": data.get("variants") if "variants" in data else existing.get("variants", []),
        # Trường này dùng để đồng bộ thứ tự kéo thả từ admin ra trang chủ trên mọi thiết bị.
        "display_order": to_display_order(
            data.get("display_order") if "display_order" in data else existing.get("display_order"),
            to_display_order(existing.get("display_order"), 999999)
        )
    }

def parse_multipart_file(req: func.HttpRequest):
    """Phân tách dữ liệu file gửi từ trình duyệt (form-data)"""
    content_type = req.headers.get("content-type") or req.headers.get("Content-Type")
    if not content_type or "multipart/form-data" not in content_type:
        raise ValueError("Yêu cầu không đúng định dạng multipart/form-data")

    body = req.get_body()
    raw_data = b"Content-Type: " + content_type.encode("utf-8") + b"\r\n\r\n" + body
    msg = BytesParser(policy=default).parsebytes(raw_data)

    for part in msg.iter_parts():
        content_disposition = part.get("Content-Disposition", "")
        if "filename=" in content_disposition:
            filename = part.get_filename()
            file_bytes = part.get_payload(decode=True)
            mime_type = part.get_content_type()
            return filename, file_bytes, mime_type
    
    raise ValueError("Không tìm thấy tệp tin ảnh trong dữ liệu gửi lên.")

# --- ROUTES SẢN PHẨM ---

@app.route(route="upload-image", methods=["POST", "OPTIONS"])
def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    try:
        filename, file_bytes, mime_type = parse_multipart_file(req)
        if not file_bytes: return json_response({"error": "Dữ liệu tệp tin trống"}, 400)
        
        container_client = get_blob_container_client()
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        # Tạo đường dẫn lưu ảnh theo Tháng/Năm để dễ quản lý
        blob_name = f"products/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}{ext}"
        blob_client = container_client.get_blob_client(blob_name)
        
        blob_client.upload_blob(file_bytes, content_settings=ContentSettings(content_type=mime_type))
        return json_response({"message": "Upload thành công", "url": blob_client.url}, 201)
    except Exception as e:
        return json_response({"error": str(e)}, 500)

@app.route(route="products", methods=["GET", "POST", "OPTIONS"])
def products(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    try:
        if req.method == "GET":
            # Lấy danh sách sản phẩm (Bỏ qua các bản ghi đơn hàng)
            query = "SELECT * FROM c WHERE c.status = 'active' AND NOT IS_DEFINED(c.type)"
            items = list(container.query_items(query=query, enable_cross_partition_query=True))
            # Ưu tiên thứ tự admin đã kéo thả. Sản phẩm chưa có display_order sẽ nằm sau, mới hơn lên trước.
            items.sort(key=lambda x: (
                to_display_order(x.get("display_order"), 999999),
                -to_sort_timestamp(x.get("created_at"))
            ))
            return json_response(items)

        if req.method == "POST":
            body = req.get_json()
            product = normalize_product(body)
            now = datetime.utcnow().isoformat() + "Z"
            product.update({
                "id": str(uuid.uuid4()),
                "created_at": now,
                "updated_at": now
            })
            container.create_item(body=product)
            return json_response({"message": "Tạo sản phẩm thành công", "item": product}, 201)

    except Exception as e:
        return json_response({"error": str(e)}, 500)

@app.route(route="products/reorder", methods=["PUT", "OPTIONS"])
def reorder_products(req: func.HttpRequest) -> func.HttpResponse:
    """Lưu thứ tự kéo thả sản phẩm từ admin vào Cosmos DB."""
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    try:
        body = req.get_json()
        raw_orders = body.get("orders") or body.get("items") or []
        if not isinstance(raw_orders, list) or not raw_orders:
            return json_response({"error": "Thiếu danh sách thứ tự sản phẩm"}, 400)

        normalized_orders = []
        for index, row in enumerate(raw_orders):
            if not isinstance(row, dict):
                continue
            product_id = str(row.get("id", "")).strip()
            if not product_id:
                continue
            normalized_orders.append({
                "id": product_id,
                "display_order": to_display_order(row.get("display_order"), index + 1)
            })

        if not normalized_orders:
            return json_response({"error": "Danh sách thứ tự không hợp lệ"}, 400)

        updated_count = 0
        now = datetime.utcnow().isoformat() + "Z"

        for order_item in normalized_orders:
            query = "SELECT * FROM c WHERE c.id = @id AND NOT IS_DEFINED(c.type)"
            items = list(container.query_items(
                query=query,
                parameters=[{"name": "@id", "value": order_item["id"]}],
                enable_cross_partition_query=True
            ))
            if not items:
                continue

            product = items[0]
            product["display_order"] = order_item["display_order"]
            product["updated_at"] = now
            container.replace_item(item=product["id"], body=product)
            updated_count += 1

        return json_response({
            "message": "Đã lưu thứ tự sản phẩm",
            "updated": updated_count,
            "total": len(normalized_orders)
        })

    except Exception as e:
        return json_response({"error": str(e)}, 500)

@app.route(route="products/{id}", methods=["PUT", "DELETE", "OPTIONS"])
def product_by_id(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    p_id = req.route_params.get("id")
    try:
        query = "SELECT * FROM c WHERE c.id = @id"
        items = list(container.query_items(query=query, parameters=[{"name": "@id", "value": p_id}], enable_cross_partition_query=True))
        if not items: return json_response({"error": "Không tìm thấy sản phẩm"}, 404)
        
        existing = items[0]
        old_brand = existing.get("brand")

        if req.method == "PUT":
            body = req.get_json()
            updated = normalize_product(body, existing)
            updated["id"] = p_id
            updated["created_at"] = existing.get("created_at")
            updated["updated_at"] = datetime.utcnow().isoformat() + "Z"
            
            # Logic quan trọng: Nếu đổi Brand (Partition Key), phải xóa cũ tạo mới
            if updated["brand"] != old_brand:
                container.delete_item(item=p_id, partition_key=old_brand)
                container.create_item(body=updated)
            else:
                container.replace_item(item=p_id, body=updated)
            return json_response({"message": "Cập nhật thành công", "item": updated})

        if req.method == "DELETE":
            container.delete_item(item=p_id, partition_key=old_brand)
            return json_response({"message": "Xóa thành công"})

    except Exception as e:
        return json_response({"error": str(e)}, 500)

@app.route(route="brands", methods=["GET", "OPTIONS"])
def brands(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    try:
        container = get_cosmos_container()
        query = "SELECT c.brand FROM c WHERE c.status = 'active' AND NOT IS_DEFINED(c.type)"
        items = list(container.query_items(query=query, enable_cross_partition_query=True))
        
        brand_count = {}
        for i in items:
            b = i.get("brand", "").strip()
            if b: brand_count[b] = brand_count.get(b, 0) + 1
            
        result = [{"brand": k, "count": v} for k, v in sorted(brand_count.items())]
        return json_response(result)
    except Exception as e:
        return json_response({"error": str(e)}, 500)


def clean_customer_text(value):
    """Làm sạch dữ liệu text khách hàng nhưng không làm thay đổi logic đơn hàng."""
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() in ("undefined", "null", "none"):
        return ""
    return text

def first_customer_value(*values):
    """Lấy giá trị đầu tiên không rỗng từ nhiều tên field khác nhau."""
    for value in values:
        text = clean_customer_text(value)
        if text:
            return text
    return ""

def join_address_parts(*parts):
    """Ghép địa chỉ và hạn chế lặp lại phường/quận/tỉnh nếu đơn đã gửi địa chỉ đầy đủ."""
    result = []
    for part in parts:
        text = clean_customer_text(part)
        if not text:
            continue
        normalized = " ".join(text.lower().split())
        exists = False
        for current in result:
            current_normalized = " ".join(str(current).lower().split())
            if normalized in current_normalized or current_normalized in normalized:
                exists = True
                break
        if not exists:
            result.append(text)
    return ", ".join(result)

def normalize_customer_info_for_order(body):
    """Giữ nguyên customer_info cũ và bổ sung address chuẩn để admin hiển thị được."""
    body = body or {}
    customer_info = body.get("customer_info", {})
    if not isinstance(customer_info, dict):
        customer_info = {}

    normalized = dict(customer_info)

    name = first_customer_value(
        customer_info.get("name"), body.get("customer_name"), body.get("name")
    )
    phone = first_customer_value(
        customer_info.get("phone"), body.get("customer_phone"), body.get("phone")
    )

    detail_address = first_customer_value(
        customer_info.get("address"),
        customer_info.get("address_detail"),
        customer_info.get("detail_address"),
        customer_info.get("street"),
        body.get("address"),
        body.get("address_detail"),
        body.get("detail_address"),
        body.get("street")
    )
    ward = first_customer_value(
        customer_info.get("ward"), customer_info.get("ward_name"),
        body.get("ward"), body.get("ward_name")
    )
    district = first_customer_value(
        customer_info.get("district"), customer_info.get("dist"), customer_info.get("district_name"),
        body.get("district"), body.get("dist"), body.get("district_name")
    )
    province = first_customer_value(
        customer_info.get("province"), customer_info.get("prov"), customer_info.get("city"), customer_info.get("province_name"),
        body.get("province"), body.get("prov"), body.get("city"), body.get("province_name")
    )
    full_address = first_customer_value(
        customer_info.get("full_address"), customer_info.get("shipping_address"), customer_info.get("customer_address"),
        body.get("full_address"), body.get("shipping_address"), body.get("customer_address")
    )

    address = join_address_parts(full_address or detail_address, ward, district, province)

    if name:
        normalized["name"] = name
    if phone:
        normalized["phone"] = phone
    if address:
        normalized["address"] = address
    if detail_address:
        normalized["address_detail"] = detail_address
    if ward:
        normalized["ward"] = ward
    if district:
        normalized["district"] = district
    if province:
        normalized["province"] = province

    return normalized



def normalize_order_phone_for_lookup(value):
    """Chuẩn hóa SĐT để tra cứu/so sánh ổn định hơn."""
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())
    if len(digits) == 9:
        digits = "0" + digits
    if digits.startswith("84") and len(digits) >= 11:
        digits = "0" + digits[2:]
    return digits


def get_order_phone_for_lookup(order):
    """Lấy SĐT của đơn hàng từ nhiều field cũ/mới để tra cứu sau khi khách chỉnh sửa."""
    info = order.get("customer_info", {}) if isinstance(order, dict) else {}
    if not isinstance(info, dict):
        info = {}
    return normalize_order_phone_for_lookup(
        info.get("phone")
        or info.get("customer_phone")
        or order.get("customer_phone")
        or order.get("phone")
        or order.get("receiver_phone")
    )


def merge_order_customer_update(existing_item, body):
    """Merge thông tin khách hàng khi khách chỉnh trên tracking.html.

    Chỉ bổ sung/ghi đè các field thông tin khách hàng khi payload có gửi lên.
    Các field đơn hàng khác như items, total_amount, payment_method, created_at... được giữ nguyên.
    Lưu cả customer_info và top-level alias để admin/tracking cũ mới đều đọc được.
    """
    existing_item = existing_item or {}
    body = body or {}

    old_info = existing_item.get("customer_info", {})
    if not isinstance(old_info, dict):
        old_info = {}

    new_info = body.get("customer_info", {})
    if not isinstance(new_info, dict):
        new_info = {}

    merged_info = dict(old_info)
    merged_info.update(new_info)

    name = first_customer_value(
        new_info.get("name"), new_info.get("customer_name"),
        body.get("customer_name"), body.get("name"), body.get("receiver_name"),
        merged_info.get("name"), merged_info.get("customer_name"),
        existing_item.get("customer_name"), existing_item.get("name"), existing_item.get("receiver_name")
    )
    phone = first_customer_value(
        new_info.get("phone"), new_info.get("customer_phone"),
        body.get("customer_phone"), body.get("phone"), body.get("receiver_phone"),
        merged_info.get("phone"), merged_info.get("customer_phone"),
        existing_item.get("customer_phone"), existing_item.get("phone"), existing_item.get("receiver_phone")
    )
    detail_address = first_customer_value(
        new_info.get("address"), new_info.get("customer_address"), new_info.get("full_address"), new_info.get("shipping_address"),
        body.get("customer_address"), body.get("full_address"), body.get("shipping_address"), body.get("address"),
        merged_info.get("address"), merged_info.get("customer_address"), merged_info.get("full_address"), merged_info.get("shipping_address"),
        existing_item.get("customer_address"), existing_item.get("full_address"), existing_item.get("shipping_address"), existing_item.get("address")
    )
    ward = first_customer_value(new_info.get("ward"), body.get("ward"), merged_info.get("ward"), existing_item.get("ward"))
    district = first_customer_value(new_info.get("district"), new_info.get("dist"), body.get("district"), body.get("dist"), merged_info.get("district"), merged_info.get("dist"), existing_item.get("district"), existing_item.get("dist"))
    province = first_customer_value(new_info.get("province"), new_info.get("prov"), new_info.get("city"), body.get("province"), body.get("prov"), body.get("city"), merged_info.get("province"), merged_info.get("prov"), merged_info.get("city"), existing_item.get("province"), existing_item.get("prov"), existing_item.get("city"))

    address = join_address_parts(detail_address, ward, district, province)
    updated_at = first_customer_value(body.get("customer_updated_at"), new_info.get("customer_updated_at")) or datetime.utcnow().isoformat() + "Z"

    if name:
        merged_info["name"] = name
        merged_info["customer_name"] = name
    if phone:
        merged_info["phone"] = phone
        merged_info["customer_phone"] = phone
    if address:
        merged_info["address"] = address
        merged_info["customer_address"] = address
        merged_info["full_address"] = address
        merged_info["shipping_address"] = address
    if ward:
        merged_info["ward"] = ward
    if district:
        merged_info["district"] = district
        merged_info["dist"] = district
    if province:
        merged_info["province"] = province
        merged_info["prov"] = province
        merged_info["city"] = province

    if body.get("updated_by_customer") or new_info.get("updated_by_customer"):
        merged_info["updated_by_customer"] = True
        merged_info["customer_updated_at"] = updated_at

    return merged_info, name, phone, address, updated_at

# --- ROUTES ĐƠN HÀNG & TRỪ KHO ---

@app.route(route="orders", methods=["GET", "POST", "OPTIONS"])
def orders_api(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    try:
        if req.method == "GET":
            query = "SELECT * FROM c WHERE c.type = 'order'"
            items = list(container.query_items(query=query, enable_cross_partition_query=True))
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return json_response(items)

        if req.method == "POST":
            body = req.get_json()
            items_list = body.get("items", [])
            
            # --- LOGIC CẬP NHẬT KHO HÀNG (TRỪ STOCK) ---
            for item in items_list:
                p_id = item.get("id")
                p_brand = item.get("brand") # Phải có brand để xác định Partition Key
                v_name = item.get("variant")
                ordered_qty = int(item.get("quantity", 0))

                if p_id and p_brand:
                    try:
                        # Truy xuất sản phẩm để sửa
                        product_doc = container.read_item(item=p_id, partition_key=p_brand)
                        if "variants" in product_doc:
                            updated = False
                            for v in product_doc["variants"]:
                                if v.get("name") == v_name:
                                    # Thực hiện trừ số lượng
                                    curr = int(v.get("stock", 0))
                                    rem = max(0, curr - ordered_qty)
                                    v["stock"] = rem
                                    # Nếu hết hàng thì đổi trạng thái
                                    if rem == 0: v["status"] = "out"
                                    updated = True
                                    break
                            
                            if updated:
                                container.replace_item(item=p_id, body=product_doc)
                    except Exception as ex:
                        print(f"Lỗi trừ kho sản phẩm {p_id}: {str(ex)}")

            # --- TẠO BẢN GHI ĐƠN HÀNG ---
            now = datetime.utcnow().isoformat() + "Z"
            customer_info = normalize_customer_info_for_order(body)

            order_data = {
                "id": str(uuid.uuid4()),
                "brand": "ORDER", # Gom tất cả đơn hàng vào 1 Partition Key để dễ truy vấn
                "type": "order",
                "order_id": body.get("order_id"),
                "customer_info": customer_info,
                "customer_address": customer_info.get("address", ""),
                "items": items_list,
                "total_amount": body.get("total_amount", 0),
                "payment_method": body.get("payment_method", "cod"),
                "status": body.get("status", "Chờ xác nhận"),
                "spx_tracking_code": "",
                "created_at": now,
                "updated_at": now
            }
            container.create_item(body=order_data)
            return json_response({"message": "Đặt hàng thành công", "order": order_data}, 201)

    except Exception as e:
        return json_response({"error": str(e)}, 500)


# =========================================================
# API CÔNG KHAI RIÊNG CHO KHÁCH CHỈNH SỬA / HỦY ĐƠN
# - Không dùng chung API quản trị /api/orders/{id}
# - Chỉ cho phép khi đơn ở đúng trạng thái được cấu hình
# - Khách phải gửi đúng số điện thoại hiện đang lưu trên đơn
# - Không cho khách sửa giá, sản phẩm, thanh toán, mã vận đơn
# =========================================================

CUSTOMER_EDITABLE_STATUSES = {
    "xac nhan dat don shipcod thanh cong",
    "dang cho hang ve viet nam",
    "cho xac nhan da chuyen khoan",
    "cho xac nhan chuyen khoan"
}


def normalize_order_status_for_customer(value):
    """Chuẩn hóa trạng thái tiếng Việt để so sánh ổn định."""
    import unicodedata

    text = str(value or "").strip().lower().replace("đ", "d")
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.split())


def is_customer_order_editable(order):
    """Khách chỉ được chỉnh sửa/hủy ở các trạng thái cho phép."""
    if not isinstance(order, dict):
        return False

    status = normalize_order_status_for_customer(order.get("status"))

    # Khi đã có mã vận đơn, không cho khách thay đổi thông tin giao hàng.
    if clean_customer_text(order.get("spx_tracking_code")):
        return False

    return status in CUSTOMER_EDITABLE_STATUSES


def find_order_for_customer_action(container, identifier):
    """Tìm đơn bằng Cosmos id hoặc mã đơn hàng MO..."""
    identifier = clean_customer_text(identifier)
    if not identifier:
        return None

    try:
        return container.read_item(item=identifier, partition_key="ORDER")
    except Exception:
        query = """
            SELECT * FROM c
            WHERE c.type = 'order'
              AND c.order_id = @order_id
        """
        found = list(container.query_items(
            query=query,
            parameters=[{"name": "@order_id", "value": identifier}],
            enable_cross_partition_query=True
        ))
        return found[0] if found else None


@app.route(route="customer-orders/{id}", methods=["PUT", "OPTIONS"])
def customer_order_action(req: func.HttpRequest) -> func.HttpResponse:
    """
    Endpoint công khai giới hạn cho trang tracking.html.

    action=update_info:
      - Chỉ sửa họ tên, số điện thoại và địa chỉ.

    action=cancel:
      - Chỉ đổi trạng thái sang Đã hủy và ghi lý do.
    """
    if req.method == "OPTIONS":
        return options_response()

    container = get_cosmos_container()
    order_identifier = req.route_params.get("id")

    try:
        body = req.get_json()
        if not isinstance(body, dict):
            return json_response({"error": "Payload không hợp lệ"}, 400)

        item = find_order_for_customer_action(container, order_identifier)
        if not item:
            return json_response({"error": "Không tìm thấy đơn hàng"}, 404)

        lookup_phone = normalize_order_phone_for_lookup(body.get("lookup_phone"))
        saved_phone = get_order_phone_for_lookup(item)

        if not lookup_phone or lookup_phone != saved_phone:
            return json_response(
                {"error": "Số điện thoại xác minh không khớp với đơn hàng"},
                403
            )

        if not is_customer_order_editable(item):
            return json_response(
                {
                    "error": (
                        "Đơn hàng không còn được phép chỉnh sửa hoặc hủy. "
                        "Chỉ áp dụng khi trạng thái là: "
                        "Xác nhận đặt đơn Shipcod thành công, "
                        "Đang chờ hàng về Việt Nam hoặc "
                        "Chờ xác nhận đã chuyển khoản."
                    )
                },
                409
            )

        action = clean_customer_text(body.get("action")).lower()
        now = datetime.utcnow().isoformat() + "Z"

        if action == "update_info":
            name = clean_customer_text(body.get("name"))
            new_phone = normalize_order_phone_for_lookup(body.get("phone"))
            address = clean_customer_text(body.get("address"))

            if len(name) < 2 or len(name) > 100:
                return json_response({"error": "Họ tên không hợp lệ"}, 400)

            if len(new_phone) != 10 or not new_phone.startswith("0"):
                return json_response({"error": "Số điện thoại không hợp lệ"}, 400)

            if len(address) < 10 or len(address) > 500:
                return json_response({"error": "Địa chỉ không hợp lệ"}, 400)

            customer_info = item.get("customer_info", {})
            if not isinstance(customer_info, dict):
                customer_info = {}

            customer_info.update({
                "name": name,
                "customer_name": name,
                "phone": new_phone,
                "customer_phone": new_phone,
                "address": address,
                "customer_address": address,
                "full_address": address,
                "shipping_address": address,
                "updated_by_customer": True,
                "customer_updated_at": now
            })

            item["customer_info"] = customer_info
            item["customer_name"] = name
            item["name"] = name
            item["receiver_name"] = name
            item["customer_phone"] = new_phone
            item["phone"] = new_phone
            item["receiver_phone"] = new_phone
            item["customer_address"] = address
            item["full_address"] = address
            item["shipping_address"] = address
            item["address"] = address
            item["updated_by_customer"] = True
            item["customer_updated_at"] = now
            item["updated_at"] = now

            container.replace_item(item=item["id"], body=item)
            return json_response({
                "message": "Đã cập nhật thông tin nhận hàng",
                "item": item
            })

        if action == "cancel":
            reason = clean_customer_text(body.get("reason"))
            if len(reason) > 500:
                return json_response({"error": "Lý do hủy quá dài"}, 400)

            item["status"] = "Đã hủy"
            item["cancel_reason"] = reason or "Khách hàng tự hủy trên trang tra cứu"
            item["cancelled_by_customer"] = True
            item["cancelled_at"] = now
            item["updated_at"] = now

            container.replace_item(item=item["id"], body=item)
            return json_response({
                "message": "Đã hủy đơn hàng",
                "item": item
            })

        return json_response({"error": "Hành động không hợp lệ"}, 400)

    except ValueError:
        return json_response({"error": "Dữ liệu JSON không hợp lệ"}, 400)
    except Exception as e:
        return json_response({"error": str(e)}, 500)


@app.route(route="orders/{id}", methods=["PUT", "DELETE", "OPTIONS"])
def order_by_id(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    o_id = req.route_params.get("id")
    try:
        # Ưu tiên đọc theo id Cosmos. Nếu frontend gửi mã MO..., fallback tìm theo order_id.
        try:
            item = container.read_item(item=o_id, partition_key="ORDER")
        except Exception:
            query = "SELECT * FROM c WHERE c.type = 'order' AND c.order_id = @order_id"
            found = list(container.query_items(
                query=query,
                parameters=[{"name": "@order_id", "value": o_id}],
                enable_cross_partition_query=True
            ))
            if not found:
                raise
            item = found[0]
            o_id = item.get("id")

        if req.method == "PUT":
            body = req.get_json()
            now = datetime.utcnow().isoformat() + "Z"

            # Giữ nguyên chức năng cũ: admin cập nhật trạng thái và mã vận đơn SPX.
            if "status" in body:
                item["status"] = body.get("status")
            if "spx_tracking_code" in body:
                item["spx_tracking_code"] = body.get("spx_tracking_code") or ""

            # Bổ sung chức năng hủy đơn từ trang tra cứu, không ảnh hưởng cập nhật trạng thái admin.
            for field in ["cancel_reason", "cancelled_by_customer", "cancelled_at"]:
                if field in body:
                    item[field] = body.get(field)

            # Bổ sung lưu thông tin khách hàng sau khi chỉnh sửa trên tracking.html.
            has_customer_update = any(key in body for key in [
                "customer_info", "customer_name", "customer_phone", "customer_address",
                "full_address", "shipping_address", "name", "phone", "address",
                "receiver_name", "receiver_phone", "updated_by_customer", "customer_updated_at"
            ])
            if has_customer_update:
                customer_info, name, phone, address, updated_at = merge_order_customer_update(item, body)
                item["customer_info"] = customer_info

                if name:
                    item["customer_name"] = name
                    item["name"] = name
                    item["receiver_name"] = name
                if phone:
                    item["customer_phone"] = phone
                    item["phone"] = phone
                    item["receiver_phone"] = phone
                if address:
                    item["customer_address"] = address
                    item["full_address"] = address
                    item["shipping_address"] = address
                    item["address"] = address

                if body.get("updated_by_customer") or customer_info.get("updated_by_customer"):
                    item["updated_by_customer"] = True
                    item["customer_updated_at"] = updated_at

            item["updated_at"] = now
            container.replace_item(item=item["id"], body=item)
            return json_response({"message": "Cập nhật đơn hàng thành công", "item": item})

        if req.method == "DELETE":
            container.delete_item(item=o_id, partition_key="ORDER")
            return json_response({"message": "Xóa đơn hàng thành công"})
            
    except Exception as e:
        return json_response({"error": str(e)}, 500)

@app.route(route="track", methods=["GET", "OPTIONS"])
def track_order(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    phone = req.params.get("phone")
    if not phone: return json_response({"error": "Thiếu số điện thoại"}, 400)
    
    try:
        container = get_cosmos_container()
        target_phone = normalize_order_phone_for_lookup(phone)

        # Tìm theo nhiều field SĐT để sau khi khách đổi 1212 -> 1213 vẫn tra cứu được bằng SĐT mới.
        # Cách này giữ tương thích với đơn cũ có customer_info.phone và đơn mới có customer_phone/phone.
        query = "SELECT * FROM c WHERE c.type = 'order'"
        all_orders = list(container.query_items(query=query, enable_cross_partition_query=True))
        items = [order for order in all_orders if get_order_phone_for_lookup(order) == target_phone]

        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return json_response(items)
    except Exception as e:
        return json_response({"error": str(e)}, 500)
