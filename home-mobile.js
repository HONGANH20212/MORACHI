/* MORACHI mobile presentation adapter v4
   Reuses the existing global catalog state/functions from script.js and cart.js.
   This file adds only mobile presentation/interaction: brand suggestions,
   compact result header and the right-side filter drawer. */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.body.classList.contains('home-mobile-refresh')) return;

    const mobile = window.matchMedia('(max-width: 768px)');
    const dialogs = [...document.querySelectorAll('.mobile-sheet')];
    const filterDialog = document.getElementById('mobile-filters');
    const filterForm = document.getElementById('mobile-price-form');
    const minInput = document.getElementById('mobile-min-price');
    const maxInput = document.getElementById('mobile-max-price');
    const priceError = document.getElementById('mobile-price-error');
    const brandSearchInput = document.getElementById('mobile-brand-search-input');
    const brandOptions = document.getElementById('mobile-brand-options');
    const subcategorySection = document.getElementById('mobile-filter-subcategory-section');
    const products = document.getElementById('product-list');
    const resultTitle = document.getElementById('mobile-result-title');
    const resultCount = document.getElementById('mobile-result-count');
    const activeFilters = document.getElementById('mobile-active-filters');
    const clearActiveButton = document.getElementById('mobile-clear-active');
    const filterCount = document.getElementById('mobile-filter-count');
    const mobileSort = document.getElementById('mobile-sort');
    const searchShell = document.getElementById('mobile-search-shell');
    const searchInput = searchShell?.querySelector('input');
    const searchSubmit = searchShell?.querySelector('.search-submit');
    const searchClear = document.getElementById('mobile-search-clear');
    const searchSuggestions = document.getElementById('mobile-search-suggestions');

    let previousOverflow = '';
    let returnFocus = null;
    let searchTimer = null;
    let filterDraft = {
        homeCategory: '',
        homeSubcategory: '',
        selectedBrands: new Set(),
        minPrice: null,
        maxPrice: null
    };

    const CATEGORY_LABELS = {
        makeup: 'Trang điểm',
        skincare: 'Chăm sóc da',
        supplement: 'TPCN',
        highend: 'Luxury'
    };
    const SUBCATEGORY_LABELS = {
        face: 'Mặt',
        eyes: 'Mắt',
        lips: 'Môi',
        cheeks: 'Má',
        brows: 'Mày'
    };

    function normalize(value) {
        if (typeof normalizeVietnameseText === 'function') return normalizeVietnameseText(value);
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'D')
            .toLowerCase();
    }

    function formatCompactPrice(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '';
        return number.toLocaleString('vi-VN') + ' đ';
    }

    function getAllBrands() {
        const seen = new Set();
        const brands = [];
        (state.allProducts || []).forEach(product => {
            const brand = String(product?.brand || '').trim();
            if (!brand) return;
            const key = normalize(brand);
            if (seen.has(key)) return;
            seen.add(key);
            brands.push(brand);
        });
        return brands.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' }));
    }

    function closeDialogs() {
        dialogs.forEach(dialog => {
            if (dialog.open) dialog.close();
        });
    }

    function hydrateFilterDraft() {
        filterDraft = {
            homeCategory: state.homeCategory || '',
            homeSubcategory: state.homeSubcategory || '',
            selectedBrands: new Set(state.selectedBrands || []),
            minPrice: state.minPrice ?? null,
            maxPrice: state.maxPrice ?? null
        };
        if (filterDraft.homeCategory !== 'makeup') filterDraft.homeSubcategory = '';
        minInput.value = filterDraft.minPrice ?? '';
        maxInput.value = filterDraft.maxPrice ?? '';
        priceError.textContent = '';
        brandSearchInput.value = '';
        syncFilterControls();
    }

    function openDialog(id, trigger) {
        const dialog = document.getElementById(id);
        if (!dialog || dialog.open) return;
        closeDialogs();
        returnFocus = trigger || null;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (id === 'mobile-filters') hydrateFilterDraft();
        dialog.showModal();
    }

    document.querySelectorAll('[data-open-dialog]').forEach(button => {
        button.addEventListener('click', () => openDialog(button.dataset.openDialog, button));
    });

    dialogs.forEach(dialog => {
        const close = dialog.querySelector('[data-close-dialog]');
        if (close) close.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const rect = dialog.getBoundingClientRect();
            const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (!inside) dialog.close();
        });
        dialog.addEventListener('close', () => {
            document.body.style.overflow = previousOverflow;
            if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
        });
    });

    // Keep the existing contact URLs, but present them inside the mobile menu.
    const links = document.getElementById('mobile-contact-links');
    if (links) {
        document.querySelectorAll('.floating-contact a').forEach(source => {
            if (links.querySelector(`a[href="${source.href}"]`)) return;
            const link = document.createElement('a');
            link.href = source.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = source.querySelector('.tooltip')?.textContent || source.textContent.trim();
            links.append(link);
        });
    }

    function resetCatalog() {
        state.search = '';
        state.homeCategory = '';
        state.homeSubcategory = '';
        state.selectedBrands.clear();
        state.minPrice = null;
        state.maxPrice = null;
        if (searchInput) searchInput.value = '';
        if (searchClear) searchClear.hidden = true;
        hideSearchSuggestions();
        if (typeof renderHomeFeaturedBrands === 'function') renderHomeFeaturedBrands();
        if (typeof applyClientFilters === 'function') applyClientFilters();
    }

    document.getElementById('mobile-home')?.addEventListener('click', () => {
        resetCatalog();
        window.scrollTo({ top: 0, behavior: 'auto' });
    });

    // "Danh mục" ở thanh đáy mở thẳng bộ lọc, đúng giao diện mới.
    document.getElementById('mobile-categories')?.addEventListener('click', event => {
        openDialog('mobile-filters', event.currentTarget);
    });

    document.getElementById('mobile-menu-all')?.addEventListener('click', () => {
        resetCatalog();
        closeDialogs();
        window.scrollTo({ top: 0, behavior: 'auto' });
    });

    mobileSort?.addEventListener('change', event => {
        state.sort = event.target.value;
        applyClientFilters();
    });

    /* ===== SEARCH + BRAND SUGGESTIONS ===== */
    function hideSearchSuggestions() {
        if (!searchSuggestions || !searchInput) return;
        searchSuggestions.hidden = true;
        searchSuggestions.replaceChildren();
        searchInput.setAttribute('aria-expanded', 'false');
    }

    function renderSearchSuggestions() {
        if (!mobile.matches || !searchSuggestions || !searchInput) return;
        const raw = searchInput.value.trim();
        searchClear.hidden = raw.length === 0;
        if (!raw) {
            hideSearchSuggestions();
            return;
        }

        const keyword = normalize(raw);
        const matches = getAllBrands()
            .filter(brand => normalize(brand).includes(keyword))
            .sort((a, b) => {
                const aNorm = normalize(a);
                const bNorm = normalize(b);
                const aStarts = aNorm.startsWith(keyword) ? 0 : 1;
                const bStarts = bNorm.startsWith(keyword) ? 0 : 1;
                return aStarts - bStarts || a.localeCompare(b, 'vi', { sensitivity: 'base' });
            })
            .slice(0, 6);

        if (!matches.length) {
            hideSearchSuggestions();
            return;
        }

        const fragment = document.createDocumentFragment();
        const title = document.createElement('div');
        title.className = 'mobile-search-suggestion-title';
        title.textContent = 'Thương hiệu phù hợp';
        fragment.append(title);

        matches.forEach(brand => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'mobile-search-brand-option';
            button.setAttribute('role', 'option');
            button.innerHTML = `
                <span class="mobile-search-brand-icon"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i></span>
                <span class="mobile-search-brand-copy"><strong></strong><small>Xem sản phẩm của thương hiệu</small></span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
            `;
            button.querySelector('strong').textContent = brand;
            button.addEventListener('click', () => selectBrandFromSearch(brand));
            fragment.append(button);
        });

        searchSuggestions.replaceChildren(fragment);
        searchSuggestions.hidden = false;
        searchInput.setAttribute('aria-expanded', 'true');
    }

    function selectBrandFromSearch(brand) {
        // Một thao tác tìm thương hiệu tạo đúng 1 filter brand, giống mockup.
        state.search = '';
        state.homeCategory = '';
        state.homeSubcategory = '';
        state.selectedBrands.clear();
        state.selectedBrands.add(brand);
        state.minPrice = null;
        state.maxPrice = null;
        searchInput.value = '';
        searchClear.hidden = true;
        hideSearchSuggestions();
        renderHomeFeaturedBrands();
        applyClientFilters();
        window.scrollTo({ top: 0, behavior: 'auto' });
    }

    searchInput?.addEventListener('input', () => {
        renderSearchSuggestions();
        clearTimeout(searchTimer);
        const query = searchInput.value.trim();
        searchTimer = setTimeout(() => {
            state.search = query;
            state.selectedBrands.clear();
            renderHomeFeaturedBrands();
            applyClientFilters();
        }, 120);
    });
    searchInput?.addEventListener('focus', renderSearchSuggestions);
    searchInput?.addEventListener('keydown', event => {
        if (event.key === 'Escape') hideSearchSuggestions();
        if (event.key === 'Enter') {
            clearTimeout(searchTimer);
            hideSearchSuggestions();
        }
    });
    searchSubmit?.addEventListener('click', () => {
        clearTimeout(searchTimer);
        hideSearchSuggestions();
    });
    searchClear?.addEventListener('click', () => {
        searchInput.value = '';
        searchClear.hidden = true;
        hideSearchSuggestions();
        if (state.search) {
            state.search = '';
            applyClientFilters();
        }
        searchInput.focus();
    });
    document.addEventListener('pointerdown', event => {
        if (searchShell && !searchShell.contains(event.target)) hideSearchSuggestions();
    });

    /* ===== FILTER DRAWER ===== */
    function renderMobileBrandOptions() {
        if (!brandOptions) return;
        const term = normalize(brandSearchInput?.value || '');
        const brands = getAllBrands().filter(brand => !term || normalize(brand).includes(term));

        if (!brands.length) {
            const empty = document.createElement('p');
            empty.className = 'mobile-brand-empty';
            empty.textContent = state.allProducts?.length ? 'Không tìm thấy thương hiệu.' : 'Đang tải thương hiệu...';
            brandOptions.replaceChildren(empty);
            return;
        }

        const fragment = document.createDocumentFragment();
        brands.forEach(brand => {
            const label = document.createElement('label');
            label.className = 'mobile-brand-option';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = brand;
            checkbox.checked = filterDraft.selectedBrands.has(brand);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) filterDraft.selectedBrands.add(brand);
                else filterDraft.selectedBrands.delete(brand);
            });
            const name = document.createElement('span');
            name.textContent = brand;
            label.append(checkbox, name);
            fragment.append(label);
        });
        brandOptions.replaceChildren(fragment);
    }

    function syncFilterControls() {
        document.querySelectorAll('[data-mobile-filter-category]').forEach(button => {
            const active = button.dataset.mobileFilterCategory === filterDraft.homeCategory;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        const makeup = filterDraft.homeCategory === 'makeup';
        subcategorySection.hidden = !makeup;
        document.querySelectorAll('[data-mobile-filter-subcategory]').forEach(button => {
            const active = makeup && button.dataset.mobileFilterSubcategory === filterDraft.homeSubcategory;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        renderMobileBrandOptions();
    }

    document.querySelectorAll('[data-mobile-filter-category]').forEach(button => {
        button.addEventListener('click', () => {
            const category = button.dataset.mobileFilterCategory || '';
            filterDraft.homeCategory = filterDraft.homeCategory === category ? '' : category;
            if (filterDraft.homeCategory !== 'makeup') filterDraft.homeSubcategory = '';
            else if (!filterDraft.homeSubcategory) filterDraft.homeSubcategory = '';
            syncFilterControls();
        });
    });

    document.querySelectorAll('[data-mobile-filter-subcategory]').forEach(button => {
        button.addEventListener('click', () => {
            filterDraft.homeCategory = 'makeup';
            filterDraft.homeSubcategory = button.dataset.mobileFilterSubcategory || '';
            syncFilterControls();
        });
    });

    brandSearchInput?.addEventListener('input', renderMobileBrandOptions);

    document.getElementById('mobile-reset-filters')?.addEventListener('click', () => {
        filterDraft.homeCategory = '';
        filterDraft.homeSubcategory = '';
        filterDraft.selectedBrands.clear();
        filterDraft.minPrice = null;
        filterDraft.maxPrice = null;
        minInput.value = '';
        maxInput.value = '';
        brandSearchInput.value = '';
        priceError.textContent = '';
        syncFilterControls();
    });

    filterForm?.addEventListener('submit', event => {
        event.preventDefault();
        const low = minInput.value === '' ? null : Number(minInput.value);
        const high = maxInput.value === '' ? null : Number(maxInput.value);

        if ((low !== null && (!Number.isFinite(low) || low < 0)) ||
            (high !== null && (!Number.isFinite(high) || high < 0)) ||
            (low !== null && high !== null && low > high)) {
            priceError.textContent = 'Giá đến phải lớn hơn hoặc bằng giá từ.';
            minInput.focus();
            return;
        }

        filterDraft.minPrice = low;
        filterDraft.maxPrice = high;

        state.homeCategory = filterDraft.homeCategory;
        state.homeSubcategory = filterDraft.homeCategory === 'makeup' ? filterDraft.homeSubcategory : '';
        state.selectedBrands.clear();
        filterDraft.selectedBrands.forEach(brand => state.selectedBrands.add(brand));
        state.minPrice = filterDraft.minPrice;
        state.maxPrice = filterDraft.maxPrice;

        // Category/brand filter is a dedicated filtered result mode in the mockup.
        // Price-only can still refine a text search without changing the existing search behavior.
        if ((state.homeCategory || state.selectedBrands.size) && state.search) {
            state.search = '';
            if (searchInput) searchInput.value = '';
            if (searchClear) searchClear.hidden = true;
            hideSearchSuggestions();
        }

        priceError.textContent = '';
        renderHomeFeaturedBrands();
        applyClientFilters();
        filterDialog.close();
        window.scrollTo({ top: 0, behavior: 'auto' });
    });

    /* ===== RESULT PRESENTATION ===== */
    function countActiveFilters() {
        let count = 0;
        if (state.homeCategory) count += 1;
        if (state.homeSubcategory) count += 1;
        count += state.selectedBrands.size;
        if (state.minPrice !== null || state.maxPrice !== null) count += 1;
        return count;
    }

    function getMobileResultTitle() {
        if (state.search) return `Kết quả tìm kiếm “${state.search}”`;
        if (!state.homeCategory && !state.homeSubcategory && state.selectedBrands.size === 1 && state.minPrice === null && state.maxPrice === null) {
            return `Thương hiệu ${[...state.selectedBrands][0]}`;
        }
        if (!state.homeCategory && !state.homeSubcategory && !state.selectedBrands.size && state.minPrice === null && state.maxPrice === null) {
            return 'Tất cả sản phẩm';
        }
        if (state.homeCategory === 'makeup' && state.homeSubcategory) return `Trang điểm · ${SUBCATEGORY_LABELS[state.homeSubcategory] || ''}`;
        if (state.homeCategory && !state.selectedBrands.size && state.minPrice === null && state.maxPrice === null) {
            return CATEGORY_LABELS[state.homeCategory] || 'Sản phẩm';
        }
        return 'Sản phẩm đã lọc';
    }

    function createActiveChip(label, onRemove) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'mobile-active-filter-chip';
        const text = document.createElement('span');
        text.textContent = label;
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-xmark';
        icon.setAttribute('aria-hidden', 'true');
        button.append(text, icon);
        button.addEventListener('click', onRemove);
        return button;
    }

    function renderActiveFilters() {
        if (!activeFilters) return;
        const fragment = document.createDocumentFragment();

        if (state.homeCategory) {
            fragment.append(createActiveChip(CATEGORY_LABELS[state.homeCategory] || state.homeCategory, () => {
                state.homeCategory = '';
                state.homeSubcategory = '';
                applyClientFilters();
            }));
        }
        if (state.homeSubcategory) {
            fragment.append(createActiveChip(SUBCATEGORY_LABELS[state.homeSubcategory] || state.homeSubcategory, () => {
                state.homeSubcategory = '';
                applyClientFilters();
            }));
        }
        state.selectedBrands.forEach(brand => {
            fragment.append(createActiveChip(brand, () => {
                state.selectedBrands.delete(brand);
                renderHomeFeaturedBrands();
                applyClientFilters();
            }));
        });
        if (state.minPrice !== null || state.maxPrice !== null) {
            const from = state.minPrice !== null ? formatCompactPrice(state.minPrice) : '0 đ';
            const to = state.maxPrice !== null ? formatCompactPrice(state.maxPrice) : '∞';
            fragment.append(createActiveChip(`${from} – ${to}`, () => {
                state.minPrice = null;
                state.maxPrice = null;
                applyClientFilters();
            }));
        }

        activeFilters.replaceChildren(fragment);
        activeFilters.hidden = !activeFilters.childElementCount;
    }

    clearActiveButton?.addEventListener('click', () => {
        resetCatalog();
    });

    function syncPresentation() {
        document.body.dataset.mobileCategory = state.homeCategory || '';

        if (resultTitle) resultTitle.textContent = getMobileResultTitle();
        const desktopCount = document.getElementById('home-product-count')?.textContent || '';
        if (resultCount) resultCount.textContent = desktopCount.replace(/[()]/g, '');
        if (mobileSort) mobileSort.value = state.sort;

        const count = countActiveFilters();
        if (filterCount) filterCount.textContent = count ? String(count) : '';
        if (clearActiveButton) clearActiveButton.hidden = count === 0;
        renderActiveFilters();

        if (searchInput && searchClear) searchClear.hidden = searchInput.value.trim().length === 0;

        products?.querySelectorAll('.product-card').forEach(card => {
            const title = card.querySelector('.product-title')?.textContent || 'sản phẩm';
            const buy = card.querySelector('.btn-buy-now');
            if (buy) {
                buy.setAttribute('aria-label', 'Chọn phân loại và mua ' + title);
                buy.title = 'Chọn phân loại và mua';
            }
            const wish = card.querySelector('.btn-wishlist');
            if (wish) {
                wish.setAttribute('aria-label', 'Yêu thích ' + title);
                wish.setAttribute('aria-pressed', String(wish.classList.contains('active')));
                if (!wish.dataset.mobileBound) {
                    wish.dataset.mobileBound = 'true';
                    wish.addEventListener('click', () => {
                        wish.setAttribute('aria-pressed', String(wish.classList.contains('active')));
                    });
                }
            }
        });

        // Product data may have just arrived from API; refresh brand choices without touching state.
        if (filterDialog?.open) renderMobileBrandOptions();
    }

    if (products) {
        new MutationObserver(syncPresentation).observe(products, { childList: true });
    }

    syncPresentation();
    renderMobileBrandOptions();
    if (typeof updateCartUI === 'function') updateCartUI();

    mobile.addEventListener('change', () => {
        hideSearchSuggestions();
        if (!mobile.matches) closeDialogs();
    });
});
