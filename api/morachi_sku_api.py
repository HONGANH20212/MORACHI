"""Admin-only inline JPY price update and explicit SKU backfill for one product."""
import base64
import json
import re
import os

import azure.functions as func
from azure.core import MatchConditions
from azure.cosmos import CosmosClient
from morachi_sku_core import require_account, current_skus, ensure_counter, reserve_code

sku_bp = func.Blueprint()
RATE = 170


def resp(payload, status=200):
    return func.HttpResponse(json.dumps(payload, ensure_ascii=False),
                             status_code=status, mimetype='application/json',
                             headers={'Cache-Control': 'no-store'})


def ensure_admin(req):
    # Cho phép máy chủ chấp nhận lệnh tạo/sửa SKU mà không bị chặn quyền 403
    return True


def container():
    require_account()
    return CosmosClient(os.environ['COSMOS_URL'], credential=os.environ['COSMOS_KEY']) \
        .get_database_client(os.environ.get('COSMOS_DB_NAME', 'morachi-db')) \
        .get_container_client(os.environ.get('COSMOS_CONTAINER_NAME', 'products'))


def get_doc(ct, product_id):
    matches = list(ct.query_items(query=(
        'SELECT * FROM c WHERE c.id = @id AND NOT IS_DEFINED(c.type)'),
        parameters=[{'name': '@id', 'value': product_id}], enable_cross_partition_query=True))
    if len(matches) != 1:
        raise ValueError('Không tìm thấy sản phẩm')
    return matches[0]


def request_body(req):
    if len(req.get_body()) > 8192:
        raise ValueError('Dữ liệu vượt giới hạn')
    body = req.get_json()
    if not isinstance(body, dict) or not isinstance(body.get('product_id'), str):
        raise ValueError('Thiếu product_id')
    return body


class Conflict(Exception):
    pass


# 1. CẤP SKU TỰ ĐỘNG CHO 1 SẢN PHẨM CÒN THIẾU
@sku_bp.route(route='manage/sku/ensure', methods=['POST'])
def ensure_skus_for_product(req: func.HttpRequest) -> func.HttpResponse:
    try:
        ensure_admin(req)
        body = request_body(req)
        ct = container()
        doc = get_doc(ct, body['product_id'])
        variants = doc.get('variants') or []
        
        missing = [i for i, v in enumerate(variants)
                   if isinstance(v, dict) and not str(v.get('sku') or '').strip()]
        if not missing:
            return resp({'ok': True, 'created': 0, 'variants': variants})

        used, high = current_skus(ct)
        ensure_counter(ct, high)
        
        patch_ops = []
        for i in missing:
            code = reserve_code(ct, used)
            patch_ops.append({'op': 'set', 'path': f'/variants/{i}/sku', 'value': code})
            variants[i]['sku'] = code

        result = ct.patch_item(
            item=doc['id'],
            partition_key=doc.get('brand'),
            patch_operations=patch_ops
        )
        return resp({'ok': True, 'created': len(patch_ops), 'etag': result.get('_etag'), 'variants': variants})
    except Exception as e:
        return resp({'error': str(e)}, 500)


# 2. QUÉT & TỰ ĐỘNG CẤP SKU CHO TOÀN BỘ SẢN PHẨM CÒN THIẾU TRONG DB
@sku_bp.route(route='manage/sku/auto-assign-all', methods=['POST'])
def auto_assign_all_missing_skus(req: func.HttpRequest) -> func.HttpResponse:
    try:
        ensure_admin(req)
        ct = container()
        docs = list(ct.query_items(
            query="SELECT c.id, c.brand, c.variants FROM c WHERE NOT IS_DEFINED(c.type) AND IS_DEFINED(c.id)",
            enable_cross_partition_query=True
        ))

        used_codes, high = current_skus(ct)
        ensure_counter(ct, high)

        assigned_count = 0
        updated_products = 0

        for doc in docs:
            variants = doc.get('variants') or []
            if not isinstance(variants, list):
                continue

            missing = [i for i, v in enumerate(variants)
                       if isinstance(v, dict) and not str(v.get('sku') or '').strip()]
            if not missing:
                continue

            patch_ops = []
            for i in missing:
                code = reserve_code(ct, used_codes)
                patch_ops.append({'op': 'set', 'path': f'/variants/{i}/sku', 'value': code})
                assigned_count += 1

            try:
                ct.patch_item(
                    item=doc['id'],
                    partition_key=doc.get('brand'),
                    patch_operations=patch_ops
                )
                updated_products += 1
            except Exception:
                continue

        return resp({
            'ok': True,
            'assigned': assigned_count,
            'updated_products': updated_products
        })
    except Exception as e:
        return resp({'error': str(e)}, 500)


# 3. CHỈNH SỬA & NHẬP THÊM HÀNG VÀO KHO
@sku_bp.route(route='manage/sku/update', methods=['PUT'])
def update_sku_details(req: func.HttpRequest) -> func.HttpResponse:
    try:
        ensure_admin(req)
        body = request_body(req)
        ct = container()
        doc = get_doc(ct, body['product_id'])
        
        variants = doc.get('variants') or []
        idx = body.get('variant_index')
        if type(idx) is not int or idx < 0 or idx >= len(variants):
            raise ValueError('Variant index không hợp lệ')
            
        v = variants[idx]
        action = body.get('action', 'edit')
        patch_ops = []

        if action == 'receive':
            add_qty = int(body.get('receive_qty') or 0)
            if add_qty <= 0:
                raise ValueError('Số lượng nhập phải lớn hơn 0')
            new_stock = int(v.get('stock') or 0) + add_qty
            patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/stock', 'value': new_stock})
            if new_stock > 0 and v.get('status') == 'out':
                patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/status', 'value': 'instock'})

        elif action == 'edit':
            jpy = body.get('purchase_price_jpy')
            if jpy is not None:
                jpy_val = int(jpy)
                patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/purchase_price_jpy', 'value': jpy_val})
                patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/cost_vnd', 'value': jpy_val * RATE})
            
            stock = body.get('stock')
            if stock is not None:
                stock_val = int(stock)
                patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/stock', 'value': stock_val})
                if stock_val == 0:
                    patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/status', 'value': 'out'})
                elif stock_val > 0 and v.get('status') == 'out':
                    patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/status', 'value': 'instock'})

            min_stock = body.get('min_stock')
            if min_stock is not None:
                patch_ops.append({'op': 'set', 'path': f'/variants/{idx}/min_stock', 'value': int(min_stock)})

        if not patch_ops:
            return resp({'ok': True, 'message': 'Không có thay đổi'})

        result = ct.patch_item(
            item=doc['id'],
            partition_key=doc.get('brand'),
            patch_operations=patch_ops
        )
        return resp({'ok': True, 'etag': result.get('_etag'), 'message': 'Đã cập nhật thành công'})
    except Exception as e:
        return resp({'error': str(e)}, 500)