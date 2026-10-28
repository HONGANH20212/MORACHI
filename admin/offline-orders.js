'use strict';
const $ = id => document.getElementById(id);
const cash = n => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';
const parsePrice = v => Number(String(v ?? '').replace(/[^0-9]/g, '')) || 0;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const STORE = { products: [], cart: [], selectedProduct: null, selectedVariant: null, quantity: 1, filter: 'all', requestId: newRequestId(), saving: false };
function newRequestId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12); }
const today = new Date();
const vnDate = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(today);
$('order-date').value = vnDate;
$('order-date').max = vnDate;

function hasStock(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  return variants.some(v => v.status === 'instock' && Number(v.stock || 0) > 0) || (!variants.length && p.status === 'active');
}
function matchesFilter(p) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (STORE.filter==='all') return true;
  if (STORE.filter==='instock') return hasStock(p);
  if (STORE.filter==='order') return variants.some(v=>v.status==='order');
  if (STORE.filter==='out') return variants.some(v=>v.status==='out' || (v.status==='instock' && Number(v.stock||0)===0));
  return true;
}
function renderCatalog() {
  const term = $('search').value.trim().toLowerCase();
  const products = STORE.products.filter(p => matchesFilter(p) &&
    [p.title,p.brand,...(Array.isArray(p.variants)?p.variants.flatMap(v=>[v.name,v.sku]):[])].join(' ').toLowerCase().includes(term));
  const el = $('catalog'); el.innerHTML = '';
  if(!products.length) { el.innerHTML='<div class="empty">Không tìm thấy sản phẩm phù hợp</div>'; return; }
  for (const p of products) {
    const btn = document.createElement('button'); btn.className='prod'; btn.type='button';
    const src = p.thumbnail || (p.variants || [])[0]?.image || '';
    const minPrice = parsePrice(p.current_price);
    btn.innerHTML = `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="brand">${esc(p.brand)}</div><strong>${esc(p.title)}</strong><div class="pr">${cash(minPrice)}</div><small>${(p.variants || []).length || 1} phân loại</small>`;
    btn.addEventListener('click',()=>openProduct(p)); el.appendChild(btn);
  }
}
function variantOpts(p) {
  return Array.isArray(p.variants) && p.variants.length ? p.variants : [{name:'Mặc định',sku:'',stock:null,status:'instock',price:p.current_price,image:p.thumbnail,purchase_price_jpy:null}];
}
function priceFor(p,v){return parsePrice(v?.price)||parsePrice(p.current_price);}
function openProduct(p) {
  STORE.selectedProduct=p; STORE.selectedVariant=null; STORE.quantity=1;
  $('sheet-name').textContent=p.title||'Sản phẩm'; $('sheet-brand').textContent=p.brand||'';
  $('sheet-img').src=p.thumbnail || variantOpts(p)[0]?.image || '';
  $('sheet-price').textContent='Giá từ '+cash(parsePrice(p.current_price));
  $('variants').innerHTML='';
  for(const v of variantOpts(p)) {
    const b=document.createElement('button'); b.type='button'; b.className='variant-btn';
    const stock = v.stock===null?'Chưa theo dõi':`Kho ${v.stock ?? 0}`;
    b.innerHTML=`<div><strong>${esc(v.name||'Mặc định')}</strong><small>${esc(v.sku||'Chưa có SKU')} · ${esc(stock)}</small></div><strong>${cash(priceFor(p,v))}</strong>`;
    b.onclick=()=>{
      STORE.selectedVariant=v;
      [...$('variants').children].forEach(x=>x.classList.toggle('chosen',x===b));
      $('sheet-img').src=v.image||p.thumbnail||'';
      $('sheet-price').textContent='Giá bán '+cash(priceFor(p,v));
    };
    $('variants').appendChild(b);
  }
  $('variants').firstElementChild?.click();
  $('qty-value').textContent='1';$('variant-overlay').classList.add('open');
}
function hideSheet() {$('variant-overlay').classList.remove('open');}
$('sheet-close').onclick=hideSheet;
$('variant-overlay').addEventListener('click',e=>{if(e.target===$('variant-overlay')) hideSheet();});
$('qty-less').onclick=()=>{STORE.quantity=Math.max(1,STORE.quantity-1);$('qty-value').textContent=STORE.quantity;};
$('qty-more').onclick=()=>{STORE.quantity=Math.min(100,STORE.quantity+1);$('qty-value').textContent=STORE.quantity;};
$('add-to-cart').onclick=()=>{
 const p=STORE.selectedProduct,v=STORE.selectedVariant;
 if(!p||!v) return;
 const key=p.id+'::'+(v.sku||v.name);
 const found=STORE.cart.find(x=>x.key===key);
 if(found) found.quantity=Math.min(100,found.quantity+STORE.quantity);
 else STORE.cart.push({key,id:p.id, sku:v.sku||'',variant:v.name||'Mặc định', title:p.title,
    brand:p.brand, image:v.image||p.thumbnail||'', quantity:STORE.quantity, unit_price:priceFor(p,v),stock:v.stock});
 hideSheet();renderCart();
};
function totals() {
 const subtotal=STORE.cart.reduce((a,b)=>a+b.unit_price*b.quantity,0);
 const ship=Math.max(0,Number($('shipping').value)||0), discount=Math.max(0,Number($('discount').value)||0);
 return {subtotal,ship,discount,total:subtotal+ship-discount};
}
function renderCart(){
 const list=$('cart-list');list.innerHTML='';
 if(!STORE.cart.length) list.innerHTML='<p class="empty">Chạm sản phẩm ở bên trái để thêm vào đơn</p>';
 for(const line of STORE.cart){
  const el=document.createElement('div');el.className='cart-row';
  el.innerHTML=`<img src="${esc(line.image)}" alt=""><div class="cart-main"><div class="cart-name">${esc(line.title)}</div><div class="cart-variant">${esc(line.variant)} · ${esc(line.sku||'Không SKU')}</div><div class="cart-controls"><div class="qty-control"><button class="mini" data-action="minus">−</button><strong>${line.quantity}</strong><button class="mini" data-action="plus">+</button></div><label class="pricebox"><input type="number" min="1" max="100000000" step="1000" aria-label="Giá bán thực tế" value="${line.unit_price}">đ</label><button class="del" data-action="remove" aria-label="Xóa">×</button></div></div>`;
  el.querySelector('[data-action="minus"]').onclick=()=>{line.quantity=Math.max(1,line.quantity-1);renderCart();};
  el.querySelector('[data-action="plus"]').onclick=()=>{line.quantity=Math.min(100,line.quantity+1);renderCart();};
  el.querySelector('[data-action="remove"]').onclick=()=>{STORE.cart=STORE.cart.filter(x=>x!==line);renderCart();};
  el.querySelector('input').onchange=e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<1||n>100000000){alert('Giá bán phải trong khoảng 1 – 100.000.000 đ');e.target.value=line.unit_price;return;}line.unit_price=n;renderSummary();};
  list.appendChild(el);
 }
 $('cart-count').textContent='('+STORE.cart.reduce((a,b)=>a+b.quantity,0)+')';
 renderSummary();
}
function renderSummary(){
 const {subtotal,ship,discount,total}=totals();
 $('subtotal').textContent=cash(subtotal); $('ship-total').textContent=cash(ship);
 $('discount-total').textContent='−'+cash(discount); $('grand-total').textContent=cash(total);
 $('sticky-total').textContent=cash(total); $('sticky-count').textContent=STORE.cart.reduce((a,b)=>a+b.quantity,0);
}
['shipping','discount'].forEach(id=>$(id).addEventListener('input',renderSummary));
$('view-cart').onclick=()=>$('order-section').scrollIntoView({behavior:'smooth',block:'start'});
$('search').addEventListener('input',renderCatalog);
$('chips').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(!b)return;STORE.filter=b.dataset.filter;[...$('chips').children].forEach(c=>c.classList.toggle('sel',c===b));renderCatalog();});

async function loadProducts(){
 try {
  const r=await fetch('/api/manage/products',{cache:'no-store'});
  if(!r.ok) throw new Error('API /api/manage/products trả '+r.status);
  const products=await r.json();
  if(!Array.isArray(products)) throw new Error('API danh sách sản phẩm không hợp lệ');
  STORE.products=products;renderCatalog();
 } catch(e) { $('catalog').innerHTML=`<p class="error">Không tải được sản phẩm: ${esc(e.message)}</p>`; }
}
async function loadRecent(){
 try {
  const r=await fetch('/api/offline-orders/recent',{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
  const data=await r.json(); const el=$('recent');el.innerHTML='';
  if(!(data.orders||[]).length){el.innerHTML='<p class="muted">Chưa có đơn Offline trên UAT.</p>';return;}
  for(const o of data.orders){const d=document.createElement('div');d.className='recent-item';d.innerHTML=`<div><strong>${esc(o.order_id)}</strong><div><span>${esc(o.customer_name||'Khách lẻ')} · ${esc(o.order_date||String(o.created_at||'').slice(0,10))} · ${esc(o.status)}</span></div></div><b>${cash(o.total_amount)}</b>`;el.appendChild(d);}
 } catch(e) {$('recent').innerHTML=`<p class="muted">Không tải được lịch sử: ${esc(e.message)}. Đăng nhập Admin qua SWA.</p>`;}
}
async function submitOrder(){
 if(STORE.saving)return;
 const msg=$('save-message');msg.innerHTML='';
 if(!STORE.cart.length){msg.innerHTML='<p class="error">Vui lòng chọn ít nhất một sản phẩm.</p>';return;}
 const {total,discount,ship}=totals();if(total<=0){msg.innerHTML='<p class="error">Tổng tiền phải lớn hơn 0đ.</p>';return;}
 if(discount>STORE.cart.reduce((a,b)=>a+b.unit_price*b.quantity,0)+ship){msg.innerHTML='<p class="error">Giảm giá vượt tổng đơn.</p>';return;}
 const data={request_id:STORE.requestId,order_date:$('order-date').value,
 customer_name:$('customer-name').value,customer_phone:$('customer-phone').value, customer_address:$('address').value,
 created_by:$('created-by').value,payment_method:$('payment').value,status:$('order-status').value,
 notes:$('notes').value,shipping_fee:ship,discount_amount:discount,
 items:STORE.cart.map(x=>({id:x.id,sku:x.sku,variant:x.variant,quantity:x.quantity,unit_price:x.unit_price}))};
 STORE.saving=true;$('save-order').disabled=true;$('save-order').textContent='Đang lưu đơn…';
 try{
  const r=await fetch('/api/offline-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const payload=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(payload.error||'HTTP '+r.status);
  msg.innerHTML=`<p class="success"><strong>✓ ${esc(payload.message||'Tạo đơn thành công')}</strong><br>Mã đơn: ${esc(payload.order_id)} · Ngày bán: ${esc(payload.date||$('order-date').value)}<br>Tổng tiền: ${cash(payload.total_amount)}<br>Đã ghi vào báo cáo doanh thu (đơn chưa hủy). Tồn kho chưa thay đổi.</p>`;
  STORE.cart=[];STORE.requestId=newRequestId();renderCart();
  await loadRecent();
 }catch(e){msg.innerHTML=`<p class="error">${esc(e.message)}. Nếu có lỗi kết nối, thử lại bằng chính nút Lưu; hệ thống sẽ kiểm tra mã yêu cầu để tránh tạo đơn trùng.</p>`;}
 finally{STORE.saving=false;$('save-order').disabled=false;$('save-order').textContent='✓ Lưu đơn Offline vào UAT';}
}
$('save-order').onclick=submitOrder;
renderCart();loadProducts();loadRecent();
