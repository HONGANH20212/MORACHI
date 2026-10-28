/* MORACHI_ADMIN_UNIFIED_V2: one /admin/ application shell, original checkout/backend untouched. */
(() => {
 'use strict';
 const TITLES = {products:'Kho sản phẩm',orders:'Đơn đặt hàng',offline:'Tạo đơn Offline',sku:'Kho SKU',pick:'Đợt nhập hàng',jpy:'Nhập giá Yên hàng loạt',revenue:'Doanh thu & Lợi nhuận'};
 const SRC = {offline:'/admin/offline-orders.html',sku:'/admin/sku-mobile.html',pick:'/admin/pick-batches.html',jpy:'/admin/bulk-jpy.html',revenue:'/admin/revenue.html'};
 const EXTERNAL = Object.fromEntries(Object.entries(SRC).map(([k,v])=>[v,k]));
 let frame, content, title, hint, current = null, legacySwitch = null, loadedFrameKey = null;
 const HEIGHT_CSS = `
 html {background:#f3f5f9!important} body{background:#f3f5f9!important;margin:0!important;padding:0!important;min-width:0!important}
 body > .layout > .side, body > .app > .sidebar {display:none!important}
 body > .layout > .app {margin:0!important;padding:12px!important;max-width:none!important;width:100%!important}
 body > .layout {min-height:auto!important}
 body > .app {width:100%!important;max-width:none!important;margin:0!important;display:block!important}
 body > .app > .workspace{width:100%!important;max-width:none!important;min-width:0!important}
 body > .app .mobile-head {display:none!important}
 body > .phone, body > #app {width:100%!important;max-width:none!important;margin:0!important;border-radius:0!important;box-shadow:none!important;min-height:100dvh!important;overflow:visible!important}
 body > .phone .header {border-radius:14px!important;margin:0 12px!important}
 body > .phone .chooser {grid-template-columns:repeat(4,minmax(0,1fr))!important}
 body > #app .grid {grid-template-columns:repeat(5,minmax(0,1fr))!important}
 body > #app .grid.two {grid-template-columns:repeat(4,minmax(0,1fr))!important}
 body > .hero, body > .wrap {width:100%!important;max-width:none!important;margin:0!important}
 body > .hero {padding-left:20px!important;padding-right:20px!important}
 body > .wrap {padding:12px 16px!important}
 body > .phone > .bottom {width:100%!important;max-width:none!important}
 body > #app > .bottom {width:100%!important;max-width:none!important}
 body > #app .sheet,body > .phone .sheet {width:min(100%,600px)!important}
 @media(max-width:1100px){body > #app .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
 @media(max-width:700px){body > #app .grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}body > .phone .chooser{grid-template-columns:repeat(2,minmax(0,1fr))!important}body > .layout > .app{padding:11px!important}body > .hero{padding:13px!important}}
 `;
 function norm(h){const key=(h||'').replace(/^#/,'').trim().toLowerCase();return TITLES[key]?key:'products'}
 function selectMenu(key){document.querySelectorAll('.sidebar-menu [data-mu-page]').forEach(el=>{el.classList.toggle('active',el.dataset.muPage===key);if(el.dataset.muPage===key){el.setAttribute('aria-current','page')}else{el.removeAttribute('aria-current')}})}
 function injectChild(){
  if(!frame || !frame.contentDocument || !frame.contentDocument.body)return;
  const d=frame.contentDocument;
  if(!d.getElementById('morachi-unified-embed-css')){const style=d.createElement('style');style.id='morachi-unified-embed-css';style.textContent=HEIGHT_CSS;d.head.appendChild(style)}
  if(!d.documentElement.dataset.muIntercept){
    d.documentElement.dataset.muIntercept='yes';
    d.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;
      const k=EXTERNAL[url.pathname]||(url.pathname==='/admin/'||url.pathname==='/admin'?'products':null);
      if(k){event.preventDefault();event.stopPropagation();window.morachiUnifiedOpen(k)}
    },true);
  }
  const path=frame.contentWindow.location.pathname;
  if(path==='/admin/login.html' || !path.startsWith('/admin/')){frame.removeAttribute('src');document.getElementById('mu-load-message').textContent='Phiên đăng nhập có thể đã hết hạn. Vui lòng đăng nhập lại.';}
 }
 function show(key,{updateHash=true}={}){
  if(!TITLES[key])key='products';
  current=key;
  const legacy = key==='products'||key==='orders';
  if(legacy){
    content.hidden=true;
    if(typeof legacySwitch==='function')legacySwitch(key);
    else {document.getElementById('section-products')?.classList.toggle('active',key==='products');document.getElementById('section-orders')?.classList.toggle('active',key==='orders')}
  } else {
    document.getElementById('section-products')?.classList.remove('active');
    document.getElementById('section-orders')?.classList.remove('active');
    content.hidden=false;
    title.textContent=TITLES[key];
    hint.textContent='Nội dung trong cùng MORACHI Admin — không chuyển trang';
    if(loadedFrameKey!==key){
      loadedFrameKey=key;
      document.getElementById('mu-load-message').textContent='Đang tải '+TITLES[key]+'…';
      frame.src=SRC[key]+'?morachi_embed=1';
    }
  }
  selectMenu(key);
  if(updateHash && location.hash!=='#'+key)history.pushState(null,'','#'+key);
  document.getElementById('mu-sidebar')?.classList.remove('mu-sidebar-open');
  document.getElementById('mu-overlay')?.classList.remove('mu-overlay-show');
  document.getElementById('mu-hamburger')?.setAttribute('aria-expanded','false');
 }
 window.morachiUnifiedOpen=(key)=>show(key);
 function init(){
  const menu=document.querySelector('.sidebar-menu');const main=document.querySelector('.main');
  if(!menu||!main){console.error('MORACHI Unified: thiếu sidebar-menu hoặc main');return}
  document.body.classList.add('morachi-unified-v2');
  document.querySelector('.sidebar')?.setAttribute('id','mu-sidebar');
  legacySwitch=typeof window.switchTab==='function'?window.switchTab.bind(window):null;
  // Keep existing product/order logic untouched; only redirect original switchTab actions.
  if(legacySwitch){window.switchTab=(tab)=>{if(tab==='products'||tab==='orders'){show(tab)}else legacySwitch(tab)}}
  const originalSidebarFooter=document.querySelector('.sidebar-footer');
  if(originalSidebarFooter && !document.getElementById('mu-logout')){
    const a=document.createElement('a');a.id='mu-logout';a.href='/.auth/logout?post_logout_redirect_uri=/admin/login.html';a.textContent='Đăng xuất';originalSidebarFooter.append(a);
  }
  const mobileHeader=document.createElement('div');mobileHeader.id='mu-mobile-header';
  mobileHeader.innerHTML='<button id="mu-hamburger" type="button" aria-label="Mở menu quản trị" aria-controls="mu-sidebar" aria-expanded="false">☰</button><b>MORACHI · ADMIN</b><span>QUẢN LÝ</span>';
  main.prepend(mobileHeader);
  const overlay=document.createElement('div');overlay.id='mu-overlay';document.body.append(overlay);
  const section=document.createElement('section');section.className='section-view';section.id='section-unified';section.hidden=true;
  section.innerHTML=`<div class="mu-panel-head"><div><h1 id="mu-panel-title"></h1><p id="mu-panel-hint"></p></div><span class="mu-tag">ADMIN</span></div><p id="mu-load-message" aria-live="polite" class="mu-loading"></p><iframe id="mu-tool-frame" title="Công cụ quản trị MORACHI" loading="eager" referrerpolicy="same-origin"></iframe>`;
  main.append(section);content=section;frame=section.querySelector('iframe');title=section.querySelector('#mu-panel-title');hint=section.querySelector('#mu-panel-hint');
  frame.addEventListener('load',()=>{document.getElementById('mu-load-message').textContent='';try{injectChild()}catch(err){console.warn('Không thể nhúng trang con',err);document.getElementById('mu-load-message').textContent='Không nhúng được nội dung, hãy kiểm tra quyền truy cập hoặc trình duyệt.'}});
  menu.addEventListener('click', e=>{
    const el=e.target.closest('[data-mu-page]');if(!el)return;
    const key=el.dataset.muPage;
    if(!(key==='products'||key==='orders')){e.preventDefault();show(key)}
    // Native products/orders onclick invokes wrapper; only prevent URL jumps for anchors.
  });
  const hamburger=document.getElementById('mu-hamburger');const nav=document.getElementById('mu-sidebar');
  hamburger.addEventListener('click',()=>{const opened=nav.classList.toggle('mu-sidebar-open');overlay.classList.toggle('mu-overlay-show',opened);hamburger.setAttribute('aria-expanded',String(opened))});
  overlay.addEventListener('click',()=>{nav.classList.remove('mu-sidebar-open');overlay.classList.remove('mu-overlay-show');hamburger.setAttribute('aria-expanded','false')});
  addEventListener('hashchange',()=>show(norm(location.hash),{updateHash:false}));
  addEventListener('popstate',()=>show(norm(location.hash),{updateHash:false}));
  show(norm(location.hash),{updateHash:false});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
