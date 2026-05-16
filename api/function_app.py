import os
import json
import uuid
import mimetypes
import re  # THÊM THƯ VIỆN RE ĐỂ XỬ LÝ CHUỖI
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
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    }

def json_response(data, status_code=200):
    return func.HttpResponse(
        json.dumps(data, ensure_ascii=False),
        mimetype="application/json",
        status_code=status_code,
        headers=cors_headers()
    )

def options_response():
    return func.HttpResponse(status_code=200, headers=cors_headers())

def get_cosmos_container():
    if not COSMOS_URL or not COSMOS_KEY:
        raise ValueError("Thiếu cấu hình Azure Cosmos DB trong ứng dụng.")
    client = CosmosClient(COSMOS_URL, credential=COSMOS_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    return database.get_container_client(COSMOS_CONTAINER_NAME)

def get_blob_container_client():
    if not BLOB_CONNECTION_STRING:
        raise ValueError("Thiếu cấu hình Azure Storage.")
    blob_service_client = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    return blob_service_client.get_container_client(BLOB_CONTAINER_NAME)

def generate_slug(text):
    """Hàm chuyển đổi Tiếng Việt có dấu thành Slug không dấu chuyên nghiệp"""
    if not text: return ""
    text = text.lower()
    # Thay thế các ký tự tiếng Việt nhóm a, o, e, u, i, d, y
    text = re.sub(r'[àáạảãâầấậẩẫăằắặẳẵ]', 'a', text)
    text = re.sub(r'[èéẹẻẽêềếệểễ]', 'e', text)
    text = re.sub(r'[òóọỏõôồốộổỗơờớợởỡ]', 'o', text)
    text = re.sub(r'[ùúụủũưừứựửữ]', 'u', text)
    text = re.sub(r'[ìíịỉĩ]', 'i', text)
    text = re.sub(r'[ỳýỵỷỹ]', 'y', text)
    text = re.sub(r'[đ]', 'd', text)
    # Xóa ký tự đặc biệt chỉ giữ lại chữ cái, số và khoảng trắng
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    # Thay khoảng trắng liền nhau hoặc gạch ngang thành một dấu gạch ngang duy nhất
    text = re.sub(r'[\s-]+', '-', text)
    return text.strip('-')

def normalize_product(data, existing=None):
    existing = existing or {}
    title = (data.get("title") or existing.get("title") or "").strip()
    
    # Tự động sinh slug dựa trên tiêu đề sản phẩm mới hoặc dùng lại slug cũ
    slug = data.get("slug") or existing.get("slug") or generate_slug(title)
    if data.get("title") and not data.get("slug"): 
        slug = generate_slug(title) # Cập nhật lại slug nếu tiêu đề đổi

    return {
        "title": title,
        "slug": slug.strip(), # BỔ SUNG TRƯỜNG SLUG ĐỒNG BỘ XUỐNG DB
        "brand": (data.get("brand") or existing.get("brand") or "").strip(),
        "thumbnail": (data.get("thumbnail") or existing.get("thumbnail") or "").strip(),
        "current_price": str(data.get("current_price") or existing.get("current_price") or "").strip(),
        "old_price": str(data.get("old_price") or existing.get("old_price") or "").strip(),
        "discount": str(data.get("discount") or existing.get("discount") or "").strip(),
        "rating": str(data.get("rating") or existing.get("rating") or "4.9").strip(),
        "sold_text": str(data.get("sold_text") or existing.get("sold_text") or "1k/tháng").strip(),
        "description": str(data.get("description") or existing.get("description") or "").strip(),
        "specifications": str(data.get("specifications") or existing.get("specifications") or "").strip(),
        "ingredients": str(data.get("ingredients") or existing.get("ingredients") or "").strip(),
        "usage_manual": str(data.get("usage_manual") or existing.get("usage_manual") or "").strip(),
        "status": (data.get("status") or existing.get("status") or "active").strip(),
        "variants": data.get("variants") if "variants" in data else existing.get("variants", [])
    }

def parse_multipart_file(req: func.HttpRequest):
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
    
    raise ValueError("Không tìm thấy tệp tin ảnh.")

# --- ROUTES SẢN PHẨM ---

@app.route(route="upload-image", methods=["POST", "OPTIONS"])
def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS": return options_response()
    try:
        filename, file_bytes, mime_type = parse_multipart_file(req)
        if not file_bytes: return json_response({"error": "Dữ liệu tệp tin trống"}, 400)
        
        container_client = get_blob_container_client()
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
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
            query = "SELECT * FROM c WHERE c.status = 'active' AND NOT IS_DEFINED(c.type)"
            items = list(container.query_items(query=query, enable_cross_partition_query=True))
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
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
            
            for item in items_list:
                p_id = item.get("id")
                p_brand = item.get("brand") 
                v_name = item.get("variant")
                ordered_qty = int(item.get("quantity", 0))

                if p_id and p_brand:
                    try:
                        product_doc = container.read_item(item=p_id, partition_key=p_brand)
                        if "variants" in product_doc:
                            updated = False
                            for v in product_doc["variants"]:
                                if v.get("name") == v_name:
                                    curr = int(v.get("stock", 0))
                                    rem = max(0, curr - ordered_qty)
                                    v["stock"] = rem
                                    if rem == 0: v["status"] = "out"
                                    updated = True
                                    break
                            
                            if updated:
                                container.replace_item(item=p_id, body=product_doc)
                    except Exception as ex:
                        print(f"Lỗi trừ kho sản phẩm {p_id}: {str(ex)}")

            now = datetime.utcnow().isoformat() + "Z"
            order_data = {
                "id": str(uuid.uuid4()),
                "brand": "ORDER", 
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