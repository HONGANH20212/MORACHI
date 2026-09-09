/* Presentation adapter: reuses the existing catalog state and cart/checkout code. */
document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('home-mobile-refresh')) return;
    const mobile = window.matchMedia('(max-width: 768px)');
    const brands = document.querySelector('.home-featured-brands');
    const anchor = document.createComment('Original desktop brands position');
    brands.before(anchor);
    const dialogs = [...document.querySelectorAll('.mobile-sheet')];
    const min = document.getElementById('mobile-min-price');
    const max = document.getElementById('mobile-max-price');
    const error = document.getElementById('mobile-price-error');
    let previousOverflow = '';
    let returnFocus = null;
    function closeDialogs() { dialogs.forEach(dialog => { if (dialog.open) dialog.close(); }); }
    function openDialog(id, trigger) {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return;
        closeDialogs();
        returnFocus = trigger;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (id === 'mobile-filters') {
            min.value = state.minPrice ?? '';
            max.value = state.maxPrice ?? '';
            error.textContent = '';
        }
        dialog.showModal();
    }
    document.querySelectorAll('[data-open-dialog]').forEach(button => {
        button.addEventListener('click', () => openDialog(button.dataset.openDialog, button));
    });
    dialogs.forEach(dialog => {
        dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.body.style.overflow = previousOverflow;
            if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
        });
    });
    function placeBrands() {
        if (mobile.matches) document.getElementById('mobile-brands-slot').append(brands);
        else { closeDialogs(); anchor.after(brands); }
    }
    placeBrands();
    mobile.addEventListener('change', placeBrands);
    // Keep existing contact destinations; only move their mobile presentation into Menu.
    const links = document.getElementById('mobile-contact-links');
    document.querySelectorAll('.floating-contact a').forEach(source => {
        const link = document.createElement('a');
        link.href = source.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.querySelector('.tooltip')?.textContent || source.textContent.trim();
        links.append(link);
    });
    function resetCatalog() {
        state.minPrice = null;
        state.maxPrice = null;
        min.value = ''; max.value = ''; error.textContent = '';
        document.getElementById('home-show-all').click();
    }
    document.getElementById('mobile-home').addEventListener('click', () => {
        resetCatalog(); window.scrollTo({top:0, behavior:'auto'});
    });
    document.getElementById('mobile-categories').addEventListener('click', () => {
        const categories = document.getElementById('home-categories');
        categories.scrollIntoView({block:'start', behavior:'auto'});
        categories.querySelector('button').focus({preventScroll:true});
    });
    document.getElementById('mobile-menu-all').addEventListener('click', () => {
        resetCatalog(); closeDialogs(); window.scrollTo({top:0, behavior:'auto'});
    });
    document.getElementById('mobile-sort').addEventListener('change', event => {
        state.sort = event.target.value;
        applyClientFilters();
    });
    document.getElementById('mobile-reset-filters').addEventListener('click', () => {
        state.selectedBrands.clear(); state.minPrice = null; state.maxPrice = null;
        min.value = ''; max.value = ''; error.textContent = '';
        renderHomeFeaturedBrands(); applyClientFilters();
    });
    document.getElementById('mobile-price-form').addEventListener('submit', event => {
        event.preventDefault();
        const low = min.value === '' ? null : Number(min.value);
        const high = max.value === '' ? null : Number(max.value);
        if ((low !== null && (!Number.isFinite(low) || low < 0)) ||
            (high !== null && (!Number.isFinite(high) || high < 0)) ||
            (low !== null && high !== null && low > high)) {
            error.textContent = 'Vui lòng nhập giá hợp lệ; giá đến phải lớn hơn hoặc bằng giá từ.';
            min.focus(); return;
        }
        state.minPrice = low; state.maxPrice = high; error.textContent = '';
        applyClientFilters(); closeDialogs();
    });
    const products = document.getElementById('product-list');
    function syncPresentation() {
        document.body.dataset.mobileCategory = state.homeCategory;
        document.getElementById('mobile-result-count').textContent = document.getElementById('home-product-count').textContent.replace(/[()]/g, '');
        document.getElementById('mobile-sort').value = state.sort;
        const count = state.selectedBrands.size + (state.minPrice !== null || state.maxPrice !== null ? 1 : 0);
        document.getElementById('mobile-filter-count').textContent = count ? String(count) : '';
        const allTab = document.querySelector('.home-subcategory[data-subcategory=""]');
        const allActive = !state.homeSubcategory && (!state.homeCategory || state.homeCategory === 'makeup');
        allTab.classList.toggle('active', allActive);
        allTab.setAttribute('aria-selected', String(allActive));
        products.querySelectorAll('.product-card').forEach(card => {
            const title = card.querySelector('.product-title')?.textContent || 'sản phẩm';
            const buy = card.querySelector('.btn-buy-now');
            if (buy) { buy.setAttribute('aria-label', 'Chọn phân loại và mua ' + title); buy.title = 'Chọn phân loại và mua'; }
            const wish = card.querySelector('.btn-wishlist');
            if (wish) {
                wish.setAttribute('aria-label', 'Yêu thích ' + title);
                wish.setAttribute('aria-pressed', String(wish.classList.contains('active')));
                if (!wish.dataset.mobileBound) {
                    wish.dataset.mobileBound = 'true';
                    wish.addEventListener('click', () => wish.setAttribute('aria-pressed', String(wish.classList.contains('active'))));
                }
            }
        });
    }
    // Child-list observation only: attribute updates above cannot cause an observer loop.
    new MutationObserver(syncPresentation).observe(products, {childList:true});
    syncPresentation();
    updateCartUI();
});
