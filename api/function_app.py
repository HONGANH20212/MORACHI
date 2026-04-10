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

COSMOS_URL = os.environ.get("COSMOS_URL")
COSMOS_KEY = os.environ.get("COSMOS_KEY")
COSMOS_DB_NAME = os.environ.get("COSMOS_DB_NAME", "morachi-db")
COSMOS_CONTAINER_NAME = os.environ.get("COSMOS_CONTAINER_NAME", "products")

BLOB_CONNECTION_STRING = os.environ.get("BLOB_CONNECTION_STRING")
BLOB_CONTAINER_NAME = os.environ.get("BLOB_CONTAINER_NAME", "products")


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
        raise ValueError("Thiếu COSMOS_URL hoặc COSMOS_KEY trong cấu hình môi trường.")

    client = CosmosClient(COSMOS_URL, credential=COSMOS_KEY)
    database = client.get_database_client(COSMOS_DB_NAME)
    return database.get_container_client(COSMOS_CONTAINER_NAME)


def get_blob_container_client():
    if not BLOB_CONNECTION_STRING:
        raise ValueError("Thiếu BLOB_CONNECTION_STRING trong cấu hình môi trường.")

    blob_service_client = BlobServiceClient.from_connection_string(BLOB_CONNECTION_STRING)
    return blob_service_client.get_container_client(BLOB_CONTAINER_NAME)


def normalize_product(data, existing=None):
    existing = existing or {}

    return {
        "title": (data.get("title") or existing.get("title") or "").strip(),
        "brand": (data.get("brand") or existing.get("brand") or "").strip(),
        "thumbnail": (data.get("thumbnail") or existing.get("thumbnail") or "").strip(),
        "current_price": str(data.get("current_price") or existing.get("current_price") or "").strip(),
        "old_price": str(data.get("old_price") or existing.get("old_price") or "").strip(),
        "discount": str(data.get("discount") or existing.get("discount") or "").strip(),
        "rating": str(data.get("rating") or existing.get("rating") or "4.9").strip(),
        "sold_text": str(data.get("sold_text") or existing.get("sold_text") or "1k/tháng").strip(),
        "status": (data.get("status") or existing.get("status") or "active").strip()
    }


def validate_product(data):
    errors = []

    if not data["title"]:
        errors.append("Thiếu title")
    if not data["brand"]:
        errors.append("Thiếu brand")
    if not data["thumbnail"]:
        errors.append("Thiếu thumbnail")
    if not data["current_price"]:
        errors.append("Thiếu current_price")

    return errors


def parse_multipart_file(req: func.HttpRequest):
    content_type = req.headers.get("content-type") or req.headers.get("Content-Type")
    if not content_type or "multipart/form-data" not in content_type:
        raise ValueError("Request phải là multipart/form-data")

    body = req.get_body()
    raw = b"Content-Type: " + content_type.encode("utf-8") + b"\r\n\r\n" + body
    msg = BytesParser(policy=default).parsebytes(raw)

    for part in msg.iter_parts():
        content_disposition = part.get("Content-Disposition", "")
        if "filename=" in content_disposition:
            filename = part.get_filename()
            file_bytes = part.get_payload(decode=True)
            mime_type = part.get_content_type() or "application/octet-stream"
            return filename, file_bytes, mime_type

    raise ValueError("Không tìm thấy file trong request")


def build_blob_name(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower() or ".jpg"
    safe_ext = ext if len(ext) <= 10 else ".jpg"
    return f"products/{datetime.utcnow().strftime('%Y/%m')}/{uuid.uuid4().hex}{safe_ext}"


def to_number(value):
    try:
        cleaned = str(value).replace(".", "").replace(",", "").replace("đ", "").replace(" ", "")
        return int(cleaned) if cleaned else 0
    except Exception:
        return 0


@app.route(route="upload-image", methods=["POST", "OPTIONS"])
def upload_image(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response()

    try:
        filename, file_bytes, mime_type = parse_multipart_file(req)

        if not file_bytes:
            return json_response({"error": "File rỗng"}, 400)

        if len(file_bytes) > 5 * 1024 * 1024:
            return json_response({"error": "Ảnh vượt quá 5MB"}, 400)

        allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
        guessed_type, _ = mimetypes.guess_type(filename)
        final_type = mime_type if mime_type in allowed_types else (guessed_type or "application/octet-stream")

        if final_type not in allowed_types:
            return json_response({"error": "Chỉ cho phép jpg, png, webp, gif"}, 400)

        container_client = get_blob_container_client()
        blob_name = build_blob_name(filename)
        blob_client = container_client.get_blob_client(blob_name)

        blob_client.upload_blob(
            file_bytes,
            overwrite=False,
            content_settings=ContentSettings(content_type=final_type)
        )

        return json_response({
            "message": "Upload ảnh thành công",
            "url": blob_client.url,
            "blob_name": blob_name
        }, 201)

    except Exception as e:
        return json_response({"error": str(e)}, 500)


@app.route(route="products", methods=["GET", "POST", "OPTIONS"])
def products(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response()

    try:
        container = get_cosmos_container()

        if req.method == "GET":
            query = "SELECT * FROM c WHERE c.status = 'active'"
            items = list(container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))

            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return json_response(items)

        if req.method == "POST":
            body = req.get_json()
            product = normalize_product(body)
            errors = validate_product(product)

            if errors:
                return json_response({"errors": errors}, 400)

            now = datetime.utcnow().isoformat() + "Z"
            item = {
                "id": str(uuid.uuid4()),
                "title": product["title"],
                "brand": product["brand"],
                "thumbnail": product["thumbnail"],
                "current_price": product["current_price"],
                "old_price": product["old_price"],
                "discount": product["discount"],
                "rating": product["rating"],
                "sold_text": product["sold_text"],
                "status": product["status"],
                "created_at": now,
                "updated_at": now
            }

            container.create_item(body=item)
            return json_response({"message": "Tạo sản phẩm thành công", "item": item}, 201)

        return json_response({"error": "Method not allowed"}, 405)

    except Exception as e:
        return json_response({"error": str(e)}, 500)


@app.route(route="products/{id}", methods=["PUT", "DELETE", "OPTIONS"])
def product_by_id(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response()

    try:
        container = get_cosmos_container()
        product_id = req.route_params.get("id")

        query = "SELECT * FROM c WHERE c.id = @id"
        items = list(container.query_items(
            query=query,
            parameters=[{"name": "@id", "value": product_id}],
            enable_cross_partition_query=True
        ))

        if not items:
            return json_response({"error": "Không tìm thấy sản phẩm"}, 404)

        existing = items[0]

        if req.method == "PUT":
            body = req.get_json()
            updated = normalize_product(body, existing)
            errors = validate_product(updated)

            if errors:
                return json_response({"errors": errors}, 400)

            old_brand = existing["brand"]

            existing["title"] = updated["title"]
            existing["brand"] = updated["brand"]
            existing["thumbnail"] = updated["thumbnail"]
            existing["current_price"] = updated["current_price"]
            existing["old_price"] = updated["old_price"]
            existing["discount"] = updated["discount"]
            existing["rating"] = updated["rating"]
            existing["sold_text"] = updated["sold_text"]
            existing["status"] = updated["status"]
            existing["updated_at"] = datetime.utcnow().isoformat() + "Z"

            if old_brand == existing["brand"]:
                container.replace_item(item=existing, body=existing)
            else:
                container.delete_item(item=product_id, partition_key=old_brand)
                container.create_item(body=existing)

            return json_response({"message": "Cập nhật sản phẩm thành công", "item": existing})

        if req.method == "DELETE":
            container.delete_item(item=product_id, partition_key=existing["brand"])
            return json_response({"message": "Xóa sản phẩm thành công"})

        return json_response({"error": "Method not allowed"}, 405)

    except Exception as e:
        return json_response({"error": str(e)}, 500)


@app.route(route="brands", methods=["GET", "OPTIONS"])
def brands(req: func.HttpRequest) -> func.HttpResponse:
    if req.method == "OPTIONS":
        return options_response()

    try:
        container = get_cosmos_container()

        query = "SELECT * FROM c WHERE c.status = 'active'"
        items = list(container.query_items(
            query=query,
            enable_cross_partition_query=True
        ))

        brand_count = {}
        for item in items:
            brand = item.get("brand", "").strip()
            if not brand:
                continue
            brand_count[brand] = brand_count.get(brand, 0) + 1

        result = [
            {"brand": brand, "count": count}
            for brand, count in sorted(brand_count.items(), key=lambda x: x[0].lower())
        ]

        return json_response(result)

    except Exception as e:
        return json_response({"error": str(e)}, 500)