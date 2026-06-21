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
            order_data = {
                "id": str(uuid.uuid4()),
                "brand": "ORDER", # Gom tất cả đơn hàng vào 1 Partition Key để dễ truy vấn
                "type": "order",
                "order_id": body.get("order_id"),
                "customer_info": body.get("customer_info", {}),
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

@app.route(route="orders/{id}", methods=["PUT", "DELETE", "OPTIONS"])
def order_by_id(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    container = get_cosmos_container()
    o_id = req.route_params.get("id")
    try:
        # Đơn hàng luôn nằm trong partition ORDER
        item = container.read_item(item=o_id, partition_key="ORDER")
        
        if req.method == "PUT":
            body = req.get_json()
            item["status"] = body.get("status", item.get("status"))
            item["spx_tracking_code"] = body.get("spx_tracking_code", item.get("spx_tracking_code", ""))
            item["updated_at"] = datetime.utcnow().isoformat() + "Z"
            container.replace_item(item=o_id, body=item)
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
        # Truy vấn tìm đơn hàng theo SĐT khách hàng
        query = "SELECT * FROM c WHERE c.type = 'order' AND c.customer_info.phone = @phone"
        items = list(container.query_items(
            query=query, 
            parameters=[{"name": "@phone", "value": phone}], 
            enable_cross_partition_query=True
        ))
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return json_response(items)
    except Exception as e:
        return json_response({"error": str(e)}, 500)