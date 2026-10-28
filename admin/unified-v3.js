/* MORACHI_ADMIN_UNIFIED_V3: all admin features remain inside /admin/#... */
(() => {
  'use strict';
  const modules = {
    offline: '/admin/offline-orders.html',
    sku: '/admin/sku-mobile.html',
    pick: '/admin/pick-batches.html',
    jpy: '/admin/bulk-jpy.html',
    revenue: '/admin/revenue.html'
  };
  const titles = {products:'Kho sản phẩm',orders:'Đơn đặt hàng',offline:'Tạo đơn Offline',sku:'Kho SKU',pick:'Đợt nhập hàng',jpy:'Nhập giá Yên hàng loạt',revenue:'Doanh thu & Lợi nhuận'};
  let current = null;
  let frame = null;
  let legacySwitch = null;
  let section = null;
  let lastFrameKey = '';
  const normalize = value => {
    const key = String(value || '').replace(/^#/, '').trim().toLowerCase();
    return key in titles ? key : 'products';
  };
  function activeMenu(key) {
    document.querySelectorAll('[data-mu3-page]').forEach(el => {
      const isActive = el.dataset.mu3Page === key;
      el.classList.toggle('active', isActive);
      el.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }
  function closeMenu() {
    document.querySelector('.sidebar')?.classList.remove('mu3-open');
    document.getElementById('mu3-shade')?.classList.remove('active');
    document.getElementById('mu3-menu-toggle')?.setAttribute('aria-expanded','false');
  }
  function go(key, options = {}) {
    key = normalize(key);
    const isLegacy = key === 'products' || key === 'orders';
    current = key;
    if (isLegacy) {
      section.classList.remove('active');
      section.hidden = true;
      if (legacySwitch) legacySwitch(key);
      else {
        document.getElementById('section-products')?.classList.toggle('active',key === 'products');
        document.getElementById('section-orders')?.classList.toggle('active',key === 'orders');
        if (key === 'orders' && typeof window.loadOrders === 'function') window.loadOrders();
      }
    } else {
      document.getElementById('section-products')?.classList.remove('active');
      document.getElementById('section-orders')?.classList.remove('active');
      section.hidden = false;
      section.classList.add('active');
      section.querySelector('#mu3-title').textContent = titles[key];
      if (lastFrameKey !== key) {
        lastFrameKey = key;
        section.querySelector('#mu3-status').textContent = 'Đang tải ' + titles[key] + '…';
        frame.src = modules[key] + '?mu_embed=1';
      }
    }
    activeMenu(key);
    closeMenu();
    if (options.push !== false && location.hash !== '#' + key) {
      history.pushState({adminPage:key}, '', '/admin/#' + key);
    }
  }
  function interceptChildNavigation(doc) {
    if (!doc || !doc.body || doc.documentElement.dataset.mu3Bound) return;
    doc.documentElement.dataset.mu3Bound = '1';
    const links = Object.fromEntries(Object.entries(modules).map(([k,v])=>[v,k]));
    doc.addEventListener('click', e => {
      const link = e.target.closest?.('a[href]');
      if (!link || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || link.download) return;
      try {
        const u = new URL(link.href, location.href);
        if (u.origin !== location.origin) return;
        const to = links[u.pathname] || ((u.pathname==='/admin/'||u.pathname==='/admin') ? 'products' : '');
        if (to) {e.preventDefault();e.stopImmediatePropagation();go(to);}
      } catch (_) {}
    }, true);
  }
  function init() {
    if (document.body.classList.contains('morachi-unified-v3')) return;
    const main = document.querySelector('body > .main');
    const menu = document.querySelector('body > .sidebar .sidebar-menu');
    if (!main || !menu) { console.error('MORACHI v3: thiếu phần .main/.sidebar-menu'); return; }
    document.body.classList.add('morachi-unified-v3');
    const original = window.switchTab;
    legacySwitch = typeof original === 'function' ? original.bind(window) : null;
    // Old admin JS may use switchTab elsewhere; keep behavior but update URL/menu.
    window.switchTab = tab => { if (tab === 'products' || tab === 'orders') go(tab); else if (legacySwitch) legacySwitch(tab); };
    section = document.createElement('section');
    section.id = 'mu3-section';
    section.className = 'section-view';
    section.hidden = true;
    section.innerHTML = '<div class="mu3-heading"><h1 id="mu3-title">Công cụ quản trị</h1><span>ADMIN</span></div><div id="mu3-status" role="status" aria-live="polite"></div><iframe id="mu3-tool" title="Công cụ MORACHI" referrerpolicy="same-origin" loading="eager"></iframe>';
    main.appendChild(section);
    frame = section.querySelector('iframe');
    frame.addEventListener('load',()=> {
      const status = section.querySelector('#mu3-status');
      try {
        const doc = frame.contentDocument;
        if (!doc || !doc.body) {status.textContent='Không truy cập được nội dung; kiểm tra quyền Admin.';return;}
        if (frame.contentWindow.location.pathname.includes('login')) {status.textContent='Phiên đăng nhập hết hạn. Hãy đăng nhập lại.';return;}
        status.textContent = '';
        interceptChildNavigation(doc);
        if (!doc.documentElement.classList.contains('mu3-embedded')) {
          doc.documentElement.classList.add('mu3-embedded');
        }
      } catch (err) {
        status.textContent = 'Không tải được nội dung. Kiểm tra quyền đăng nhập hoặc trình duyệt.';
        console.error(err);
      }
    });
    // A single capture handler; menu contains buttons only, never links to other HTML.
    menu.addEventListener('click',event => {
      const button = event.target.closest('[data-mu3-page]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      go(button.dataset.mu3Page);
    },true);
    const mobile = document.createElement('div');
    mobile.id='mu3-mobile-header';
    mobile.innerHTML='<button type="button" id="mu3-menu-toggle" aria-controls="mu3-sidebar" aria-expanded="false" aria-label="Mở menu">☰</button><strong>MORACHI · ADMIN</strong>';
    main.prepend(mobile);
    document.querySelector('body > .sidebar')?.setAttribute('id','mu3-sidebar');
    const shade=document.createElement('div');shade.id='mu3-shade';document.body.appendChild(shade);
    document.getElementById('mu3-menu-toggle').addEventListener('click',()=>{
      const opened=document.querySelector('.sidebar').classList.toggle('mu3-open');
      shade.classList.toggle('active',opened);
      document.getElementById('mu3-menu-toggle').setAttribute('aria-expanded',String(opened));
    });
    shade.addEventListener('click',closeMenu);
    window.morachiUnifiedOpen = go;
    window.addEventListener('popstate',()=>go(location.hash,{push:false}));
    window.addEventListener('hashchange',()=>go(location.hash,{push:false}));
    go(location.hash,{push:false});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
