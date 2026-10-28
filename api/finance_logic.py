"""Pure report calculations for MORACHI operational revenue (VND)."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone, date
from calendar import monthrange
from zoneinfo import ZoneInfo
import re
import unicodedata

TZ = ZoneInfo('Asia/Ho_Chi_Minh')
RATE = 170

def clean(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value or '')).strip().split())

def folded(value):
    text = unicodedata.normalize('NFKD', clean(value)).casefold().replace('đ', 'd')
    return ''.join(ch for ch in text if not unicodedata.combining(ch))

def money(value):
    if isinstance(value, bool): return 0
    if isinstance(value, (int, float)): return max(0, round(value))
    # Source order and purchase data may include VND separators, e.g. "209.000 đ"
    digits = re.sub(r'\D', '', str(value or ''))
    return int(digits) if digits else 0

def is_cancelled(order):
    s = folded(order.get('status'))
    return 'huy' in s or 'cancel' in s or bool(order.get('cancelled_at'))

def order_day(order):
    raw = clean(order.get('created_at'))
    if not raw: return None
    try:
        dt = datetime.fromisoformat(raw.replace('Z', '+00:00'))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ).date().isoformat()
    except ValueError:
        return None

def as_period(day, mode):
    return day if mode == 'day' else day[:7]

def period_range(mode, period):
    if mode == 'day':
        dt = date.fromisoformat(period)
        return dt, dt + timedelta(days=1)
    if not re.fullmatch(r'\d{4}-\d{2}', period): raise ValueError('Tháng không hợp lệ')
    y, m = map(int, period.split('-'))
    first = date(y,m,1)
    last = date(y+1,1,1) if m == 12 else date(y,m+1,1)
    return first, last

def period_keys(mode, period):
    start, end = period_range(mode, period)
    if mode == 'day':
        return [(start-timedelta(days=i)).isoformat() for i in range(6,-1,-1)]
    y, m = start.year, start.month
    result = []
    for i in range(5,-1,-1):
        idx = y * 12 + m - 1 - i
        result.append(f'{idx//12:04d}-{idx%12+1:02d}')
    return result

def window_for(mode, period):
    keys = period_keys(mode, period)
    earliest,_ = period_range(mode, keys[0]); _,end = period_range(mode,period)
    return earliest, end

def utc_iso(day):
    dt = datetime.combine(day, datetime.min.time(), tzinfo=TZ).astimezone(timezone.utc)
    return dt.isoformat(timespec='seconds').replace('+00:00','Z')

def build_product_index(products):
    out = {}
    for doc in products:
        if not isinstance(doc, dict): continue
        pid = clean(doc.get('id'))
        vars_ = doc.get('variants') if isinstance(doc.get('variants'),list) else []
        for v in vars_:
            if not isinstance(v,dict):continue
            key = (pid, folded(v.get('name')))
            if key not in out: out[key] = v
        if len(vars_) == 1 and isinstance(vars_[0],dict):
            out[(pid,'__only__')] = vars_[0]
    return out


# MORACHI_LEGACY_COST_V1: Stable month + historical order product identity.
# Including brand/title prevents erroneously grouping reused Product IDs.
def legacy_cost_key(order, item):
    import hashlib
    import json
    day = order_day(order)
    if not day or not isinstance(item, dict):
        return ''
    if not (clean(item.get('id')) or clean(item.get('title'))):
        return ''
    parts = [day[:7], clean(item.get('id')), folded(item.get('brand')),
             folded(item.get('title')), folded(item.get('variant'))]
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()

def build_legacy_cost_index(legacy_costs):
    result = {}
    for doc in legacy_costs or []:
        key = clean(doc.get('legacy_key'))
        if doc.get('type') != 'legacy_cost' or len(key) != 64:
            continue
        price = doc.get('purchase_price_jpy')
        if type(price) is int and price > 0:
            result[key] = doc
    return result

def item_cost(item, index, legacy_index=None, order=None):
    # MORACHI_OFFLINE_COST_SNAPSHOT_V1: Dùng giá vốn tại thời điểm bán Offline.
    # Không thay đổi các dòng đơn Online cũ hoặc giá vốn lịch sử do Admin đã bổ sung.
    if isinstance(item, dict) and item.get('unit_cost_vnd_snapshot') not in (None, ''):
        try:
            unit_cost = int(item['unit_cost_vnd_snapshot'])
            quantity = int(item.get('quantity') or 1)
            if unit_cost > 0 and quantity > 0:
                return unit_cost * quantity
        except (ValueError, TypeError):
            pass
    # Historical override takes priority, scoped to the original order month.
    if order is not None and legacy_index:
        key = legacy_cost_key(order, item)
        doc = legacy_index.get(key)
        if doc:
            try: quantity = int(item.get('quantity') or 1)
            except (ValueError, TypeError): quantity = 0
            return doc['purchase_price_jpy'] * RATE * quantity if quantity > 0 else None
    # Do not silently assume a purchase price from selling price or from a similar variant.
    pid = clean(item.get('id'))
    variant_name = folded(item.get('variant'))
    variant = index.get((pid,variant_name))
    if not variant and (not variant_name or variant_name == 'mac dinh'):
        variant = index.get((pid,'__only__'))
    if not variant: return None
    raw = variant.get('purchase_price_jpy')
    if raw in (None,''): return None
    try:
        amount = int(raw)
        if amount <= 0: return None
    except (TypeError, ValueError): return None
    try: quantity = int(item.get('quantity') or 1)
    except (TypeError, ValueError): quantity = 0
    if quantity <= 0: return None
    return amount * RATE * quantity


# MORACHI_MISSING_COGS_V1: reason for each order line whose COGS is unknown.
def missing_cost_detail(item, index, products_by_id, order):
    item = item if isinstance(item, dict) else {}
    pid = clean(item.get('id'))
    product = products_by_id.get(pid) or {}
    variant_name = clean(item.get('variant')) or 'Mặc định'
    lookup = folded(item.get('variant'))
    variant = index.get((pid, lookup))
    if not variant and (not lookup or lookup == 'mac dinh'):
        variant = index.get((pid, '__only__'))

    reason = ''
    if not pid:
        reason = 'Dòng đơn hàng thiếu Product ID'
    elif not product:
        reason = 'Không tìm thấy sản phẩm trong Kho sản phẩm'
    elif not variant:
        reason = 'Không khớp phân loại/màu với Kho sản phẩm'
    else:
        raw = variant.get('purchase_price_jpy')
        if raw is None or raw == '':
            reason = 'SKU chưa nhập giá mua JPY'
        else:
            try:
                if isinstance(raw, bool) or int(raw) <= 0:
                    reason = 'Giá mua JPY không hợp lệ'
            except (TypeError, ValueError):
                reason = 'Giá mua JPY không hợp lệ'
        if not reason:
            try:
                if int(item.get('quantity') or 1) <= 0:
                    reason = 'Số lượng trên đơn hàng không hợp lệ'
            except (ValueError, TypeError):
                reason = 'Số lượng trên đơn hàng không hợp lệ'
    return {
        'order_id': clean(order.get('order_id') or order.get('id')),
        'date': order_day(order) or '',
        'product_id': pid,
        'brand': clean(item.get('brand') or product.get('brand')),
        'title': clean(item.get('title') or product.get('title')) or '[Không xác định]',
        'variant': variant_name,
        'sku': clean(variant.get('sku')) if variant else '',
        'quantity': item.get('quantity') if isinstance(item.get('quantity'), (int, float, str)) else '',
        'reason': reason or 'Chưa xác định giá vốn',
        'legacy_key': legacy_cost_key(order, item),
    }

def expense_vnd(entry):
    try: amount = int(entry.get('amount') or 0)
    except (TypeError, ValueError): amount = 0
    if amount < 0: return 0
    return amount * (RATE if entry.get('currency') == 'JPY' else 1)

def build_report(orders, products, expenses, mode, period, legacy_costs=None):
    keys = period_keys(mode,period)
    index = build_product_index(products)
    legacy_index = build_legacy_cost_index(legacy_costs)
    used_legacy_keys = set()
    products_by_id = {clean(p.get('id')): p for p in products if isinstance(p, dict)}
    missing_cost_items = []
    aggregates = {key: dict(revenue=0,cogs_known=0,expense_total=0,missing_cost_lines=0,orders_count=0,cancelled_count=0,
                            bank_total=0,cod_total=0,other_payment_total=0,expense_count=0) for key in keys}
    ui_orders = {key: [] for key in keys}; ui_expenses = {key: [] for key in keys}
    for order in orders:
        day = order_day(order)
        if not day: continue
        key = as_period(day,mode)
        if key not in aggregates: continue
        d = aggregates[key]
        if is_cancelled(order): d['cancelled_count'] += 1; continue
        revenue = money(order.get('total_amount') if order.get('total_amount') is not None else order.get('total'))
        d['revenue'] += revenue; d['orders_count'] += 1
        payment = folded(order.get('payment_method'))
        if 'cod' in payment: d['cod_total'] += revenue
        elif payment in ('bank','transfer','bank_transfer') or 'chuyen khoan' in payment or 'vietqr' in payment: d['bank_total'] += revenue
        else: d['other_payment_total'] += revenue
        items = order.get('items') if isinstance(order.get('items'), list) else order.get('products')
        items = items if isinstance(items,list) else []
        missing = 0
        if not items:
            missing = 1
            if key == period:
                detail = missing_cost_detail({}, index, products_by_id, order)
                detail['reason'] = 'Đơn hàng không có danh sách sản phẩm'
                missing_cost_items.append(detail)
        for item in items:
            if not isinstance(item,dict):
                missing += 1
                if key == period:
                    detail = missing_cost_detail({}, index, products_by_id, order)
                    detail['reason'] = 'Dòng hàng không hợp lệ'
                    missing_cost_items.append(detail)
                continue
            lk = legacy_cost_key(order,item)
            if key == period and lk in legacy_index:
                used_legacy_keys.add(lk)
            value = item_cost(item,index,legacy_index,order)
            if value is None:
                missing += 1
                if key == period:
                    missing_cost_items.append(missing_cost_detail(item, index, products_by_id, order))
            else: d['cogs_known'] += value
        d['missing_cost_lines'] += missing
        ui_orders[key].append({'order_id': clean(order.get('order_id') or order.get('id')),
                   'date': day, 'status': clean(order.get('status')),
                   'payment_method': clean(order.get('payment_method')),
                   'revenue': revenue, 'missing_cost_lines':missing,
                   'item_count': len(items)})
    for expense in expenses:
        day = clean(expense.get('date'))
        key = as_period(day,mode)
        if key not in aggregates: continue
        value = expense_vnd(expense)
        aggregates[key]['expense_total'] += value
        aggregates[key]['expense_count'] += 1
        ui_expenses[key].append({'id':expense.get('id'),'category':expense.get('category'),'name':expense.get('name',''),
           'amount':expense.get('amount'), 'currency':expense.get('currency'),'amount_vnd':value,
           'date':day,'batch':expense.get('batch',''),'note':expense.get('note',''),'etag':expense.get('_etag','')})
    for d in aggregates.values():
        if d['missing_cost_lines']:
            d['gross'] = None; d['profit'] = None
        else:
            d['gross'] = d['revenue'] - d['cogs_known']
            d['profit'] = d['gross'] - d['expense_total']
    chart = [{'period':k, **aggregates[k]} for k in keys]
    return {'mode':mode,'period':period,'rate':RATE,'summary':aggregates[period],
            'chart':chart,'missing_cost_items':missing_cost_items,
            'legacy_cost_overrides': [
                {'legacy_key':k, 'purchase_price_jpy':legacy_index[k]['purchase_price_jpy'],
                 'title':legacy_index[k].get('title',''), 'brand':legacy_index[k].get('original_brand',''),
                 'variant':legacy_index[k].get('variant',''),
                 'order_month':legacy_index[k].get('order_month',''),
                 'etag':legacy_index[k].get('_etag','')}
                for k in sorted(used_legacy_keys)],
            'orders':sorted(ui_orders[period],key=lambda x:x['order_id'],reverse=True),
            'expenses':sorted(ui_expenses[period],key=lambda x:x['date'],reverse=True)}
