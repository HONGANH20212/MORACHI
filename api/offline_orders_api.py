"""MORACHI UAT: create offline orders; compatible with existing online orders and revenue report.

Important: This module intentionally does NOT change inventory. Do not deploy to production
without reviewing security and inventory policy. The SWA route must enforce morachiadmin.
"""
from __future__ import annotations

import base64
import json
import os
import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import azure.functions as func
from azure.cosmos import CosmosClient
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosResourceExistsError

bp_offline_orders = func.Blueprint()
LOCAL_TZ = ZoneInfo('Asia/Ho_Chi_Minh')
RATE = 170
MAX_BODY_BYTES = 32_768


def respond(data, status=200):
    return func.HttpResponse(
        json.dumps(data, ensure_ascii=False), status_code=status,
        mimetype='application/json', headers={'Cache-Control': 'no-store'})


def txt(x, limit=200):
    return str(x or '').strip()[:limit]


def positive_int(value, field, minimum=1, maximum=100_000_000):
    if isinstance(value, bool) or isinstance(value, float):
        raise ValueError(field + ' phải là số nguyên')
    try:
        n = int(value)
    except (ValueError, TypeError):
        raise ValueError(field + ' phải là số nguyên')
    if not minimum <= n <= maximum:
        raise ValueError(f'{field} phải trong khoảng {minimum}–{maximum}')
    return n


def uat_container():
    url = txt(os.getenv('COSMOS_URL'), 500)
    host = (urlparse(url).hostname or '').lower()
    if (urlparse(url).scheme != 'https' or host != (
    f"{(os.environ.get('COSMOS_ALLOWED_ACCOUNT') or 'mrc-uat').strip().lower()}"
    ".documents.azure.com"
)
            or os.getenv('COSMOS_DB_NAME', 'morachi-db') != 'morachi-db'
            or os.getenv('COSMOS_CONTAINER_NAME', 'products') != 'products'):
        raise PermissionError('Chỉ cho phép Cosmos DB UAT mrc-uat / morachi-db / products')
    key = os.getenv('COSMOS_KEY')
    if not key:
        raise ValueError('Thiếu COSMOS_KEY của UAT')
    ct = (CosmosClient(url, credential=key)
          .get_database_client('morachi-db')
          .get_container_client('products'))
    if ct.read().get('partitionKey', {}).get('paths') != ['/brand']:
        raise ValueError('Partition key không phải /brand')
    return ct


def ensure_admin(req):
    """Confirm SWA admin role; also require SWA route protection at reverse proxy.

    Header is not a cryptographic credential. Function port must not be exposed publicly.
    """
    header = req.headers.get('x-ms-client-principal', '')
    if not header:
        raise PermissionError('Cần đăng nhập Admin qua http://localhost:4280 (SWA)')
    try:
        principal = json.loads(base64.b64decode(header).decode('utf-8'))
        roles = principal.get('userRoles') or principal.get('user_roles') or []
    except (ValueError, UnicodeError):
        raise PermissionError('Phiên đăng nhập không hợp lệ')
    if 'morachiadmin' not in roles:
        raise PermissionError('Tài khoản thiếu quyền morachiadmin')


def find_product(ct, product_id):
    docs = list(ct.query_items(
        query='SELECT * FROM c WHERE c.id = @id AND NOT IS_DEFINED(c.type)',
        parameters=[{'name': '@id', 'value': product_id}],
        enable_cross_partition_query=True))
    return docs[0] if len(docs) == 1 else None


def get_variant(product, sku, variant_name):
    variants = product.get('variants')
    variants = variants if isinstance(variants, list) else []
    if not variants:
        return None, 'Mặc định'
    if sku:
        matches = [v for v in variants if isinstance(v, dict)
                   and txt(v.get('sku'), 64) == sku]
        if len(matches) != 1:
            raise ValueError('SKU không tồn tại hoặc không duy nhất trong sản phẩm')
        variant = matches[0]
        if variant_name and txt(variant.get('name')) != variant_name:
            raise ValueError('Màu đã thay đổi trong Kho sản phẩm, vui lòng tải lại')
        return variant, txt(variant.get('name'))
    matches = [v for v in variants if isinstance(v, dict)
               and txt(v.get('name')) == variant_name]
    if len(matches) != 1:
        raise ValueError('Không tìm thấy phân loại trong Kho sản phẩm')
    return matches[0], txt(matches[0].get('name'))


def price_vnd(value):
    if isinstance(value, int) and not isinstance(value, bool):
        return max(0, value)
    return int(re.sub(r'[^0-9]', '', str(value or '')) or '0')


def build_items(ct, raw_items):
    if not isinstance(raw_items, list) or not 1 <= len(raw_items) <= 30:
        raise ValueError('Đơn hàng cần 1–30 dòng sản phẩm')
    result, keys, cache = [], set(), {}
    for row in raw_items:
        if not isinstance(row, dict):
            raise ValueError('Dòng sản phẩm không hợp lệ')
        pid = txt(row.get('id'), 80)
        sku = txt(row.get('sku'), 64)
        vname = txt(row.get('variant'))
        qty = positive_int(row.get('quantity'), 'Số lượng', 1, 100)
        if not pid:
            raise ValueError('Thiếu Product ID')
        identity = (pid, sku or vname)
        if identity in keys:
            raise ValueError('Sản phẩm bị trùng trong đơn; vui lòng tăng số lượng')
        keys.add(identity)
        if pid not in cache:
            cache[pid] = find_product(ct, pid)
        product = cache[pid]
        if not product or product.get('status') != 'active':
            raise ValueError('Sản phẩm không còn bán hoặc đã bị xóa')
        variant, actual_name = get_variant(product, sku, vname)
        if variant is not None:
            sku = txt(variant.get('sku'), 64)
        else:
            if vname not in ('', 'Mặc định'):
                raise ValueError('Sản phẩm không có phân loại này')
            sku = ''
        published_price = price_vnd((variant or {}).get('price')) or price_vnd(product.get('current_price'))
        raw_price = row.get('unit_price')
        unit_price = positive_int(raw_price if raw_price is not None else published_price,
                                  'Giá bán', 1, 100_000_000)
        jpy = (variant or {}).get('purchase_price_jpy')
        try:
            jpy = int(jpy) if jpy is not None and jpy != '' else None
            if jpy is not None and jpy <= 0:
                jpy = None
        except (ValueError, TypeError):
            jpy = None
        item = {
            'id': pid, 'sku': sku, 'title': txt(product.get('title')),
            'brand': txt(product.get('brand'), 100), 'variant': actual_name,
            'image': txt((variant or {}).get('image') or product.get('thumbnail'), 1000),
            'price': unit_price, 'quantity': qty, 'line_total': unit_price * qty,
            'status': txt((variant or {}).get('status') or 'instock', 30),
            'date': txt((variant or {}).get('date'), 60),
            # Snapshot allows future reporting to keep historical costs.
            'purchase_price_jpy': jpy,
            'unit_cost_vnd_snapshot': jpy * RATE if jpy is not None else None,
        }
        result.append(item)
    return result


def compute_created_at(day_text):
    now = datetime.now(timezone.utc)
    today = now.astimezone(LOCAL_TZ).date()
    if not day_text:
        selected = today
    else:
        try:
            selected = date.fromisoformat(day_text)
        except ValueError:
            raise ValueError('Ngày bán không hợp lệ')
        if selected > today or selected < today - timedelta(days=365):
            raise ValueError('Ngày bán phải trong 365 ngày qua, không được là ngày tương lai')
    if selected == today:
        created = now
    else:
        created = datetime.combine(selected, time(12, 0), tzinfo=LOCAL_TZ).astimezone(timezone.utc)
    return (created.isoformat(timespec='seconds').replace('+00:00','Z'),
            now.isoformat(timespec='seconds').replace('+00:00','Z'), selected.isoformat())


def build_order(ct, payload):
    request_id = txt(payload.get('request_id'), 40)
    try:
        uuid.UUID(request_id)
    except (ValueError, TypeError):
        raise ValueError('Request ID không hợp lệ; hãy tải lại trang')
    items = build_items(ct, payload.get('items'))
    customer_name = txt(payload.get('customer_name'), 100) or 'Khách lẻ'
    customer_phone = txt(payload.get('customer_phone'), 25)
    if customer_phone and not re.fullmatch(r'[+0-9 ()-]{8,25}', customer_phone):
        raise ValueError('Số điện thoại không hợp lệ')
    customer_address = txt(payload.get('customer_address'), 300)
    payment = txt(payload.get('payment_method'), 20)
    if payment not in ('cash', 'bank', 'cod'):
        raise ValueError('Hình thức thanh toán không hợp lệ')
    status = txt(payload.get('status'), 100)
    if status not in ('Đã giao hàng', 'Đang chuẩn bị hàng', 'Đang giao hàng', 'Đang chờ hàng về Việt Nam'):
        raise ValueError('Trạng thái đơn hàng không hợp lệ')
    shipping = positive_int(payload.get('shipping_fee',0), 'Phí ship', 0, 100_000_000)
    discount = positive_int(payload.get('discount_amount',0), 'Giảm giá', 0, 100_000_000)
    subtotal = sum(item['line_total'] for item in items)
    if discount > subtotal + shipping:
        raise ValueError('Giảm giá lớn hơn tổng tiền đơn hàng')
    total = subtotal + shipping - discount
    if total <= 0:
        raise ValueError('Tổng đơn hàng phải lớn hơn 0đ')
    created, recorded, local_day = compute_created_at(txt(payload.get('order_date'), 10))
    code = 'MO' + datetime.now(timezone.utc).strftime('%m%d%H%M%S') + uuid.uuid4().hex[:4].upper()
    label = {'cash':'Tiền mặt','bank':'Chuyển khoản','cod':'Ship COD'}[payment]
    pstatus = {'cash':'Đã thu tiền','bank':'Chờ xác nhận thanh toán','cod':'Thu tiền khi giao hàng'}[payment]
    return {
        'id': 'offline-' + request_id, 'brand': 'ORDER', 'type': 'order',
        'source': 'offline', 'order_channel': 'offline',
        'order_id': code, 'customer_info': {
            'name':customer_name,'phone':customer_phone,'address':customer_address},
        'customer_name':customer_name,'customer_phone':customer_phone,'customer_address':customer_address,
        'items': items, 'products': items,
        'subtotal':subtotal,'shipping_fee':shipping, 'discount_amount':discount,
        'total_amount':total,'total':total,
        'payment_method': payment, 'payment_label': label,
        'payment_status':pstatus, 'status':status,
        'notes': txt(payload.get('notes'), 600), 'created_by':txt(payload.get('created_by'),100),
        'inventory_deducted': False,
        'inventory_note':'Chưa tự động trừ tồn kho; cần đối soát riêng',
        'created_at':created,'order_date':local_day,
        'recorded_at':recorded,'updated_at':recorded,
    }


@bp_offline_orders.route(route='offline-orders', methods=['POST'])
def create_offline_order(req: func.HttpRequest) -> func.HttpResponse:
    try:
        ensure_admin(req)
        raw = req.get_body()
        if len(raw) > MAX_BODY_BYTES:
            raise ValueError('Đơn hàng quá lớn')
        payload = json.loads(raw.decode('utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('Nội dung đơn hàng không hợp lệ')
        ct = uat_container()
        rid = txt(payload.get('request_id'), 40)
        try:
            uuid.UUID(rid)
        except (TypeError, ValueError):
            raise ValueError('Request ID không hợp lệ')
        item_id = 'offline-' + rid
        try:
            existing = ct.read_item(item=item_id, partition_key='ORDER')
            if existing.get('source') == 'offline':
                return respond({'message':'Đơn offline đã được ghi nhận trước đó',
                                'order_id':existing.get('order_id'), 'total_amount':existing.get('total_amount'),
                                'duplicate':True}, 200)
            raise ValueError('Request ID đã được sử dụng')
        except CosmosResourceNotFoundError:
            pass
        order = build_order(ct, payload)
        try:
            ct.create_item(body=order)
        except CosmosResourceExistsError:
            return respond({'error':'Đơn đã được ghi nhận; tải lại trang trước khi tạo đơn khác'},409)
        return respond({'message':'Đã lưu đơn hàng Offline vào Cosmos DB UAT',
                        'order_id':order['order_id'],'total_amount':order['total_amount'],
                        'date':order['order_date'],'inventory_deducted':False},201)
    except PermissionError as e:
        return respond({'error':str(e)},403)
    except (ValueError, json.JSONDecodeError) as e:
        return respond({'error':str(e)},400)
    except Exception as e:
        print('OFFLINE_ORDER_CREATE_ERROR:',type(e).__name__,str(e))
        return respond({'error':'Không lưu được đơn Offline; kiểm tra log Azure Functions'},500)


@bp_offline_orders.route(route='offline-orders/recent', methods=['GET'])
def recent_offline_orders(req: func.HttpRequest) -> func.HttpResponse:
    try:
        ensure_admin(req)
        ct = uat_container()
        rows = list(ct.query_items(
            query="SELECT TOP 30 c.id, c.order_id, c.created_at, c.order_date, c.total_amount, "
                  "c.status, c.payment_method, c.customer_name FROM c "
                  "WHERE c.type = 'order' AND c.source = 'offline' ORDER BY c._ts DESC",
            enable_cross_partition_query=True))
        return respond({'orders': rows})
    except PermissionError as e:
        return respond({'error':str(e)},403)
    except Exception as e:
        print('OFFLINE_ORDER_RECENT_ERROR:',type(e).__name__,str(e))
        return respond({'error':'Không tải được đơn Offline gần đây'},500)
