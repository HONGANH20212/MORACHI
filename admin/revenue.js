'use strict';
// MORACHI UAT: Server is the source of truth. No fake orders or browser-stored expenses.
const RATE=170;
const TYPES={
 shipping_jp:{name:'Vận chuyển từ Nhật',icon:'🚚'}, carton:{name:'Thùng carton',icon:'📦'},
 tape:{name:'Băng keo',icon:'🧻'}, shipping_vn:{name:'Vận chuyển nội địa',icon:'🛵'},
 packing:{name:'Vật liệu đóng gói',icon:'🎁'}, other:{name:'Chi phí khác',icon:'✏️'}
};
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'Chưa đủ dữ liệu':Math.round(v).toLocaleString('vi-VN')+' đ';
const compact=v=>v==null?'—':Math.abs(v)>=1e6?(v/1e6).toLocaleString('vi-VN',{maximumFractionDigits:1})+'tr':Math.abs(v)>=1e3?(v/1e3).toLocaleString('vi-VN',{maximumFractionDigits:0})+'k':Math.round(v).toString();
const dateVN=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'});
const today=dateVN.format(new Date());
let mode='day', selectedDay=today, selectedMonth=today.slice(0,7), report=null, editingId=null, busy=false;
function activePeriod(){return mode==='day'?selectedDay:selectedMonth;}
function dLocal(d){const p=String(d||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(d||'');}
function showToast(msg){const el=$('toast');el.textContent=msg;el.style.display='block';setTimeout(()=>{el.style.display='none';},4500)}
async function api(path, opts={}){
 const r=await fetch('/api/finance/'+path,{cache:'no-store',credentials:'same-origin',...opts,headers:{'Accept':'application/json', ...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
 let obj={};try{obj=await r.json()}catch{}
 if(!r.ok)throw new Error(obj.error||`API trả về HTTP ${r.status}`);
 return obj;
}
function updatePickers(){
 $('dayPicker').classList.toggle('hidden',mode!=='day');$('monthPicker').classList.toggle('hidden',mode!=='month');
 $('dayPicker').value=selectedDay;$('monthPicker').value=selectedMonth;
 $('modeDay').classList.toggle('selected',mode==='day');$('modeMonth').classList.toggle('selected',mode==='month');
 $('dayPicker').max=today; $('monthPicker').max=today.slice(0,7); $('fDate').max=today;
}
async function load(){
 updatePickers();
 $('ordersMetric').textContent='Đang tải dữ liệu UAT…';
 try{
  report=await api(`report?mode=${encodeURIComponent(mode)}&period=${encodeURIComponent(activePeriod())}`);
  render();
 }catch(e){report=null;render();showToast('Không tải được báo cáo: '+e.message);}
}
function render(){
 const s=report?.summary;
 $('revMetric').textContent=s?fmt(s.revenue):'—';
 $('cogsMetric').textContent=s?fmt(s.cogs_known):'—';
 $('expenseMetric').textContent=s?fmt(s.expense_total):'—';
 $('profitMetric').textContent=s?fmt(s.profit):'—';
 $('ordersMetric').textContent=s?`${s.orders_count} đơn chưa hủy`:'Không tải được dữ liệu';
 $('expensesCount').textContent=s?`${s.expense_count} khoản trong kỳ`:'—';
 $('profitMargin').textContent=!s?'—':s.missing_cost_lines?`Thiếu giá vốn ${s.missing_cost_lines} dòng hàng`:s.revenue?`Biên lợi nhuận ${(s.profit/s.revenue*100).toLocaleString('vi-VN',{maximumFractionDigits:1})}%`:'Doanh thu − Giá vốn − Chi phí';
 $('collectedMetric').textContent=s?fmt(s.bank_total):'—';
 $('uncollectedMetric').textContent=s?fmt(s.cod_total):'—';
 $('cancelledMetric').textContent=s?`Đã loại ${s.cancelled_count} đơn hủy trong kỳ.`:'—';
 $('formulaRev').textContent=s?fmt(s.revenue):'—';
 $('formulaCogs').textContent=s?'− '+fmt(s.cogs_known):'—';
 $('formulaGross').textContent=s?fmt(s.gross):'—';
 $('formulaExpenses').textContent=s?'− '+fmt(s.expense_total):'—';
 $('formulaProfit').textContent=s?fmt(s.profit):'—';
 $('orderPill').textContent=s?`${s.orders_count} đơn`:'—';
 $('costWarning').hidden=!(s&&s.missing_cost_lines);
 if(s?.missing_cost_lines) $('costWarning').textContent=`Chưa có giá nhập JPY hoặc không khớp phân loại của ${s.missing_cost_lines} dòng hàng trong đơn. Giá vốn hiển thị là phần đã xác định; hệ thống không tính lợi nhuận khi còn thiếu giá vốn.`;
 renderChart();renderExpense();renderOrders();renderMissingCosts();renderLegacyCosts();
}

// MORACHI_MISSING_COGS_V1: details of order lines without known purchase cost.
function renderMissingCosts(){
 const lines=report?.missing_cost_items||[];
 const section=$('missingCostSection');
 section.hidden=!lines.length;
 if(!lines.length){$('missingCostList').innerHTML='';return;}
 const groups=new Map();
 for(const m of lines){
  const key=m.legacy_key||'';
  if(!key)continue;
  if(!groups.has(key))groups.set(key,{...m,orders:[],lines:0,units:0});
  const g=groups.get(key);g.lines++;
  g.units+=Math.max(0,Number(m.quantity)||0);
  g.orders.push(m.order_id);
 }
 $('missingCostTitle').textContent=`⚠ ${lines.length} dòng thiếu giá vốn · ${groups.size} nhóm có thể nhập giá`;
 const ignored=lines.length-[...groups.values()].reduce((n,g)=>n+g.lines,0);
 $('missingCostList').innerHTML=[...groups.values()].map(g=>`<div class="missing-cost-row">
  <div class="missing-main">${safe(g.title||'[Sản phẩm cũ]')}</div>
  <div class="missing-meta">${safe(g.brand||'')} · ${safe(g.variant||'Mặc định')} · ${g.lines} dòng / ${g.units} món</div>
  <div class="missing-meta missing-order">Đơn: ${safe([...new Set(g.orders)].join(', '))}</div>
  <div class="missing-reason">${safe(g.reason)}</div>
  <div class="legacy-entry"><label>Giá mua lịch sử (¥ / món)<input type="number" min="1" step="1" placeholder="Ví dụ: 770" data-key="${safe(g.legacy_key)}" aria-label="Giá mua JPY lịch sử" /></label><button class="btn slim" data-action="create" data-key="${safe(g.legacy_key)}">Lưu giá</button></div>
 </div>`).join('')+(ignored?`<p class="card-note">${ignored} dòng thiếu thông tin nhận diện; cần kiểm tra thủ công.</p>`:'');
}
function exportMissingCosts(){
 const lines=report?.missing_cost_items||[];if(!lines.length)return;
 const rows=[['Ngày','Mã đơn','Product ID','Thương hiệu','Sản phẩm','Phân loại','SKU','Số lượng','Lý do thiếu giá vốn'],
    ...lines.map(x=>[x.date,x.order_id,x.product_id,x.brand,x.title,x.variant,x.sku,x.quantity,x.reason])];
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv='\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download=`MORACHI_THIEU_GIA_VON_${activePeriod()}.csv`;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

// MORACHI_LEGACY_COST_V1: update historical price without touching order or stock.
function renderLegacyCosts(){
 const list=report?.legacy_cost_overrides||[];
 const el=$('legacyCostList');
 el.innerHTML=list.map(x=>`<div class="missing-cost-row">
  <div class="missing-main">${safe(x.title||'[Sản phẩm cũ]')}</div>
  <div class="missing-meta">${safe(x.original_brand||x.brand||'')} · ${safe(x.variant||'Mặc định')} · Tháng ${safe(x.order_month)}</div>
  <div class="legacy-entry"><label>Giá lịch sử (¥) <input type="number" min="1" step="1" value="${Number(x.purchase_price_jpy)||''}" data-key="${safe(x.legacy_key)}" data-kind="edit" aria-label="Giá JPY lịch sử"></label><button class="btn slim" data-action="update" data-key="${safe(x.legacy_key)}">Cập nhật</button><button class="btn secondary slim" data-action="delete" data-key="${safe(x.legacy_key)}">Xóa</button></div>
 </div>`).join('');
 $('legacyCostSection').hidden=!list.length;
}
async function legacyCostAction(event,kind){
 const btn=event.target.closest('button[data-action][data-key]');
 if(!btn)return;
 const key=btn.dataset.key;
 const existing=(report?.legacy_cost_overrides||[]).find(x=>x.legacy_key===key);
 const edit=btn.dataset.action==='update';
 const del=btn.dataset.action==='delete';
 if(del && !window.confirm('Xóa giá vốn lịch sử này? Báo cáo có thể lại thiếu giá vốn.'))return;
 const input=(del?null:(kind==='missing'?$('missingCostList'):$('legacyCostList')).querySelector(`input[data-key="${key}"]`));
 const qty=del?null:Number(input?.value);
 if(!del && (!Number.isInteger(qty)||qty<=0||qty>10000000)){showToast('Giá JPY phải là số nguyên dương');return;}
 let orderMonth=kind==='missing'?activePeriod().slice(0,7):existing?.order_month;
 if(!orderMonth){showToast('Thiếu tháng đơn hàng');return;}
 const body={legacy_key:key,order_month:orderMonth};
 if(!del)body.purchase_price_jpy=qty;
 if(existing)body.etag=existing.etag;
 const method=del?'DELETE':edit?'PUT':'POST';
 btn.disabled=true;
 try{
  const result=await api('legacy-costs',{method,body:JSON.stringify(body)});
  await load();showToast(result.message||'Đã cập nhật giá vốn lịch sử UAT');
 }catch(e){showToast('Không lưu được giá vốn: '+e.message);btn.disabled=false;}
}
function renderChart(){
 const rows=report?.chart||[];
 $('chartPeriod').textContent=mode==='day'?'7 ngày':'6 tháng';
 if(!rows.length){$('bars').innerHTML='<div class="empty">Chưa có dữ liệu.</div>';return;}
 const max=Math.max(...rows.map(x=>x.revenue),1);
 $('bars').innerHTML=rows.map(r=>{
  const hp=r.profit==null?0:Math.max(0,Math.round(r.profit/max*112));
  const hr=Math.max(0,Math.round(r.revenue/max*112));
  const label=mode==='day'?r.period.slice(-2):'T'+Number(r.period.slice(-2));
  const desc=`${r.period}: Doanh thu ${fmt(r.revenue)}, lợi nhuận ${fmt(r.profit)}`;
  return `<div class="chart-col" title="${safe(desc)}"><div class="bars"><div class="bar rev" style="height:${Math.max(2,hr)}px"></div><div class="bar profit" style="height:${hp}px"></div></div><div class="chart-lbl">${safe(label)}</div></div>`;
 }).join('');
}
function renderExpense(){
 const es=report?.expenses||[];
 const total=es.reduce((sum,e)=>sum+e.amount_vnd,0);
 const cats=Object.keys(TYPES).map(category=>({category,total:es.filter(e=>e.category===category).reduce((a,e)=>a+e.amount_vnd,0)})).filter(x=>x.total);
 $('expenseBreakdown').innerHTML=cats.length?cats.map(x=>`<div class="category-line"><span>${safe(TYPES[x.category].name)}</span><div class="track"><div class="fill" style="width:${x.total/total*100}%"></div></div><strong>${compact(x.total)}</strong></div>`).join(''):'<div class="empty">Chưa có chi phí trong kỳ.</div>';
 $('expenseList').innerHTML=es.length?es.map(e=>`<div class="expense"><div class="expense-icon">${TYPES[e.category]?.icon||'✏️'}</div><div class="expense-info"><div class="expense-name">${safe(e.category==='other'&&e.name?e.name:TYPES[e.category]?.name||'Chi phí khác')}</div><div class="expense-meta">${safe(dLocal(e.date))}${e.batch?' · '+safe(e.batch):''}${e.note?' · '+safe(e.note):''}</div></div><div class="expense-right"><strong>−${fmt(e.amount_vnd)}</strong><button class="tinybtn" data-action="edit" data-id="${safe(e.id)}">Sửa</button> <button class="tinybtn" data-action="delete" data-id="${safe(e.id)}">Xóa</button></div></div>`).join(''):'<div class="empty">Chưa ghi nhận chi phí. Nhấn “＋ Thêm” để nhập khoản chi.</div>';
}
function renderOrders(){
 const orders=report?.orders||[];
 $('orderList').innerHTML=orders.length?orders.slice(0,50).map(o=>`<div class="order"><div class="order-mark">🛍</div><div><div class="order-title">${safe(o.order_id)}</div><div class="order-sub">${safe(dLocal(o.date))} · ${o.item_count} dòng sản phẩm</div><div class="order-sub">${safe(o.status)} · ${safe(o.payment_method)}${o.missing_cost_lines?' · ⚠ Chưa đủ giá vốn':''}</div></div><div class="order-price">${fmt(o.revenue)}<small>Đơn đặt chưa hủy</small></div></div>`).join(''):'<div class="empty">Chưa có đơn chưa hủy trong kỳ.</div>';
}
function movePeriod(step){
 if(mode==='day'){
  const d=new Date(selectedDay+'T12:00:00');d.setDate(d.getDate()+step);
  const next=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  if(next>today)return;selectedDay=next;selectedMonth=next.slice(0,7);
 }else{
  const [y,m]=selectedMonth.split('-').map(Number);const d=new Date(y,m-1+step,1);
  const next=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  if(next>today.slice(0,7))return;selectedMonth=next;
 }load();
}
function toggleOther(){$('otherNameField').classList.toggle('hidden',$('fCategory').value!=='other');}
function updateConverted(){const a=Number($('fAmount').value)||0;$('convertedValue').textContent=fmt(a*($('fCurrency').value==='JPY'?RATE:1));}
function openSheet(expense=null){
 editingId=expense?.id||null;
 $('sheetTitle').textContent=expense?'Sửa khoản chi phí':'Thêm chi phí phát sinh';
 $('expenseForm').reset();$('fCategory').value=expense?.category||'shipping_jp';$('fName').value=expense?.name||'';
 $('fAmount').value=expense?.amount??'';$('fCurrency').value=expense?.currency||'VND';
 $('fDate').value=expense?.date||(mode==='day'?selectedDay:selectedMonth+'-01');
 $('fBatch').value=expense?.batch||'';$('fNote').value=expense?.note||'';
 toggleOther();updateConverted();$('sheet').classList.add('open');$('overlay').classList.add('open');document.body.style.overflow='hidden';
}
function closeSheet(){$('sheet').classList.remove('open');$('overlay').classList.remove('open');document.body.style.overflow='';editingId=null;}
async function saveExpense(event){
 event.preventDefault();if(busy)return;
 const raw=Number($('fAmount').value);
 if(!Number.isInteger(raw)||raw<=0){showToast('Số tiền phải là số nguyên dương');return;}
 const data={category:$('fCategory').value,name:$('fName').value.trim(),amount:raw,
  currency:$('fCurrency').value,date:$('fDate').value,batch:$('fBatch').value.trim(),note:$('fNote').value.trim()};
 const previous=(report?.expenses||[]).find(e=>e.id===editingId);
 if(editingId&&!previous){showToast('Khoản chi không có trong kỳ hiện tại, vui lòng tải lại');return;}
 busy=true;$('saveExpense').disabled=true;
 try{
  const path=editingId?`expenses/${encodeURIComponent(editingId)}`:'expenses';
  const method=editingId?'PUT':'POST';
  await api(path,{method,headers:editingId?{'If-Match':previous.etag}:{},body:JSON.stringify(data)});
  closeSheet();await load();showToast('Đã lưu chi phí vào Cosmos DB UAT');
 }catch(e){showToast('Không lưu được: '+e.message);}finally{busy=false;$('saveExpense').disabled=false;}
}
async function expenseAction(ev){
 const btn=ev.target.closest('button[data-action]');if(!btn)return;
 const exp=(report?.expenses||[]).find(e=>e.id===btn.dataset.id);if(!exp)return;
 if(btn.dataset.action==='edit'){openSheet(exp);return;}
 if(!window.confirm(`Xóa khoản chi ${fmt(exp.amount_vnd)} khỏi Cosmos DB UAT?`))return;
 try{await api(`expenses/${encodeURIComponent(exp.id)}`,{method:'DELETE',headers:{'If-Match':exp.etag}});await load();showToast('Đã xóa khoản chi UAT');}
 catch(e){showToast('Không xóa được: '+e.message);}
}
function exportExpenses(){
 const header=['Ngày','Nhóm chi phí','Tên chi phí','Số tiền gốc','Loại tiền','Thành tiền VND','Đợt nhập','Ghi chú'];
 const rows=[header,...(report?.expenses||[]).map(e=>[e.date,TYPES[e.category]?.name||e.category,e.name,e.amount,e.currency,e.amount_vnd,e.batch,e.note])];
 const quoted=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
 const csv='\uFEFF'+rows.map(row=>row.map(quoted).join(',')).join('\r\n');
 const uri=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=uri;a.download=`MORACHI_CHI_PHI_${activePeriod()}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(uri),1000);
}
$('modeDay').onclick=()=>{mode='day';load();};$('modeMonth').onclick=()=>{mode='month';load();};
$('prevPeriod').onclick=()=>movePeriod(-1);$('nextPeriod').onclick=()=>movePeriod(1);
$('dayPicker').onchange=e=>{if(e.target.value && e.target.value<=today){selectedDay=e.target.value;selectedMonth=selectedDay.slice(0,7);load();}};
$('monthPicker').onchange=e=>{if(e.target.value && e.target.value<=today.slice(0,7)){selectedMonth=e.target.value;load();}};
for(const id of ['topAdd','expenseAdd','navAdd'])$(id).onclick=()=>openSheet();
for(const id of ['closeSheet','cancelForm','overlay'])$(id).onclick=closeSheet;
$('fCategory').onchange=toggleOther;$('fAmount').oninput=updateConverted;$('fCurrency').onchange=updateConverted;
$('expenseForm').onsubmit=saveExpense;$('expenseList').addEventListener('click',expenseAction);
$('csvExport').onclick=exportExpenses;
$('missingCostCsv').onclick=exportMissingCosts;
$('missingCostList').addEventListener('click',e=>legacyCostAction(e,'missing'));
$('legacyCostList').addEventListener('click',e=>legacyCostAction(e,'legacy'));
$('navOverview').onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
$('navExpenses').onclick=()=>$('expenseSection').scrollIntoView({behavior:'smooth'});
$('navOrders').onclick=()=>$('ordersSection').scrollIntoView({behavior:'smooth'});
updatePickers();load();
