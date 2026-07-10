const API_BASE_URL = "/api";

const state = {
    allProducts: [],
    filteredProducts: [],
    selectedBrands: new Set(),
    sort: "bestseller", // Mặc định hiển thị tab Bán chạy
    search: "",
    category: "all",
    minPrice: null,
    maxPrice: null
};
// Trang chủ chỉ lấy thứ tự sản phẩm từ API/backend.
// Không dùng localStorage ở trang khách để điện thoại/máy tính luôn đồng bộ cùng một thứ tự admin đã lưu.
function normalizeProductsFromApi(products) {
    return (Array.isArray(products) ? products : []).map((item, index) => ({
        ...item,
        __api_index: index
    }));
}

function hasDisplayOrder(item) {
    const raw = item && (item.display_order ?? item.sort_order ?? item.position);
    const number = Number(raw);
    return Number.isFinite(number) && number > 0;
}


// --- Các hàm tiện ích ---
function parsePrice(value) {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/[^\d]/g, "");
    return cleaned ? Number(cleaned) : 0;
}

function formatPrice(value) {
    const number = parsePrice(value);
    return number.toLocaleString("vi-VN") + " đ";
}

function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =========================================================
// DANH MỤC THÔNG MINH + TÌM KIẾM GỢI Ý
// - Không cần backend có sẵn category: tự nhận diện từ tên/brand/mô tả/variant
// - Nếu sau này backend có trường category thì vẫn ưu tiên dùng kèm dữ liệu đó
// =========================================================
const MORACHI_CATEGORIES = [
    { id: "all", label: "Tất cả", icon: "fa-border-all", keywords: [] },
    { id: "ma-hong", label: "Má hồng", icon: "fa-wand-magic-sparkles", keywords: ["má hồng", "ma hong", "blush", "cheek", "cream cheek"] },
    { id: "phan-phu", label: "Phấn phủ", icon: "fa-circle-half-stroke", keywords: ["phấn phủ", "phan phu", "powder", "finish powder", "marshmallow"] },
    { id: "kem-nen", label: "Kem nền / Kem lót", icon: "fa-fill-drip", keywords: ["kem nền", "kem nen", "foundation", "cushion", "kem lót", "kem lot", "primer", "base"] },
    { id: "son", label: "Son môi", icon: "fa-kiss-wink-heart", keywords: ["son", "lip", "lipstick", "tint", "gloss", "rouge"] },
    { id: "skincare", label: "Skincare", icon: "fa-spa", keywords: ["skincare", "serum", "toner", "lotion", "cleanser", "sữa rửa mặt", "sua rua mat", "kem dưỡng", "kem duong", "chống nắng", "chong nang", "sunscreen", "spf"] },
    { id: "instock", label: "Hàng có sẵn", icon: "fa-box-open", keywords: [] },
    { id: "order", label: "Hàng order", icon: "fa-plane", keywords: [] }
];

function normalizeTextForSearch(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

function getProductSearchText(product) {
    const variantsText = Array.isArray(product.variants)
        ? product.variants.map(v => `${v.name || ""} ${v.status || ""} ${v.date || v.expected_date || ""}`).join(" ")
        : "";

    return [
        product.title,
        product.brand,
        product.category,
        product.discount,
        product.description,
        product.specifications,
        product.ingredients,
        variantsText
    ].filter(Boolean).join(" ");
}

function productHasStatus(product, statusList) {
    const statuses = statusList.map(normalizeTextForSearch);
    const productStatus = normalizeTextForSearch(product.status || "");
    if (statuses.some(st => productStatus.includes(st))) return true;

    if (Array.isArray(product.variants) && product.variants.length) {
        return product.variants.some(v => statuses.some(st => normalizeTextForSearch(v.status || "").includes(st)));
    }

    return false;
}

function inferProductCategoryIds(product) {
    const ids = new Set();
    const rawText = getProductSearchText(product);
    const text = normalizeTextForSearch(rawText);

    MORACHI_CATEGORIES.forEach(cat => {
        if (!cat.keywords.length) return;
        if (cat.keywords.some(keyword => text.includes(normalizeTextForSearch(keyword)))) {
            ids.add(cat.id);
        }
    });

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const hasInStockVariant = variants.length
        ? variants.some(v => {
            const status = normalizeTextForSearch(v.status || "instock");
            return status.includes("instock") || status.includes("san") || status.includes("con");
        })
        : !["out", "order", "het", "hết", "inactive"].some(st => text.includes(normalizeTextForSearch(st)));

    const hasOrderVariant = variants.length
        ? variants.some(v => {
            const status = normalizeTextForSearch(v.status || "");
            return status.includes("order") || status.includes("out") || status.includes("het");
        })
        : false;

    if (hasInStockVariant) ids.add("instock");
    if (hasOrderVariant || text.includes("hang order") || text.includes("hàng order")) {
        ids.add("order");
    }

    return ids;
}

function productMatchesCategory(product, categoryId) {
    if (!categoryId || categoryId === "all") return true;
    return inferProductCategoryIds(product).has(categoryId);
}

function productMatchesSearch(product, keyword) {
    const normalizedKeyword = normalizeTextForSearch(keyword);
    if (!normalizedKeyword) return true;
    return normalizeTextForSearch(getProductSearchText(product)).includes(normalizedKeyword);
}

function renderCategoryFilters(products) {
    const container = document.getElementById("category-filter-list");
    if (!container) return;

    const counts = new Map(MORACHI_CATEGORIES.map(cat => [cat.id, 0]));
    (products || []).forEach(product => {
        counts.set("all", (counts.get("all") || 0) + 1);
        inferProductCategoryIds(product).forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
    });

    container.innerHTML = MORACHI_CATEGORIES
        .filter(cat => cat.id === "all" || (counts.get(cat.id) || 0) > 0)
        .map(cat => `
            <button type="button" class="category-chip ${state.category === cat.id ? "active" : ""}" data-category="${cat.id}">
                <i class="fa-solid ${cat.icon}"></i>
                <span>${cat.label}</span>
                <b>${counts.get(cat.id) || 0}</b>
            </button>
        `).join("");

    container.querySelectorAll(".category-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            state.category = btn.dataset.category || "all";
            renderCategoryFilters(state.allProducts);
            applyClientFilters();
        });
    });

    setupMobileFilterCompact();
}

function getTopSearchSuggestions(keyword, limit = 6) {
    const q = normalizeTextForSearch(keyword);
    if (!q) return [];

    return [...state.allProducts]
        .filter(product => productMatchesSearch(product, q))
        .sort((a, b) => {
            const aTitle = normalizeTextForSearch(a.title || "");
            const bTitle = normalizeTextForSearch(b.title || "");
            const aBrand = normalizeTextForSearch(a.brand || "");
            const bBrand = normalizeTextForSearch(b.brand || "");
            const scoreA = (aTitle.startsWith(q) ? 20 : 0) + (aBrand.startsWith(q) ? 10 : 0) + (hasDisplayOrder(a) ? 5 : 0);
            const scoreB = (bTitle.startsWith(q) ? 20 : 0) + (bBrand.startsWith(q) ? 10 : 0) + (hasDisplayOrder(b) ? 5 : 0);
            if (scoreA !== scoreB) return scoreB - scoreA;
            return getDisplayOrder(a) - getDisplayOrder(b);
        })
        .slice(0, limit);
}

function initSmartSearchAutocomplete() {
    const { input, button } = getSearchElements();
    const searchBar = document.querySelector(".search-bar");
    if (!input || !button || !searchBar) return;

    searchBar.classList.add("smart-search-wrap");

    let dropdown = searchBar.querySelector(".smart-search-dropdown");
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.className = "smart-search-dropdown";
        dropdown.style.display = "none";
        searchBar.appendChild(dropdown);
    }

    let debounceTimer = null;

    const hideDropdown = () => {
        dropdown.style.display = "none";
    };

    const renderDropdown = () => {
        const keyword = input.value.trim();
        const suggestions = getTopSearchSuggestions(keyword, 7);

        if (!keyword || suggestions.length === 0) {
            hideDropdown();
            return;
        }

        dropdown.innerHTML = `
            <div class="smart-search-title"><i class="fa-solid fa-bolt"></i> Gợi ý phù hợp</div>
            ${suggestions.map(product => `
                <div class="smart-search-item" data-id="${escapeHtml(product.id)}">
                    <img src="${escapeHtml(product.thumbnail || "images/icon-logo.png")}" alt="${escapeHtml(product.title || "Sản phẩm")}" onerror="this.src='images/icon-logo.png'">
                    <div class="smart-search-info">
                        <div class="smart-search-name">${escapeHtml(product.title || "Sản phẩm")}</div>
                        <div class="smart-search-meta">${escapeHtml(product.brand || "MORACHI")} • ${formatPrice(product.current_price)}</div>
                    </div>
                </div>
            `).join("")}
            <button type="button" class="smart-search-view-all"><i class="fa-solid fa-magnifying-glass"></i> Xem tất cả kết quả cho “${escapeHtml(keyword)}”</button>
        `;

        dropdown.querySelectorAll(".smart-search-item").forEach(item => {
            item.addEventListener("mousedown", e => e.preventDefault());
            item.addEventListener("click", () => {
                const id = item.dataset.id;
                if (id) openProductDetail(id);
            });
        });

        const viewAll = dropdown.querySelector(".smart-search-view-all");
        if (viewAll) {
            viewAll.addEventListener("mousedown", e => e.preventDefault());
            viewAll.addEventListener("click", () => {
                state.search = keyword;
                applyClientFilters();
                hideDropdown();
            });
        }

        dropdown.style.display = "block";
    };

    const runRealtimeSearch = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.search = input.value.trim();
            applyClientFilters();
            renderDropdown();
        }, 120);
    };

    input.addEventListener("input", runRealtimeSearch);
    input.addEventListener("focus", renderDropdown);
    input.addEventListener("keydown", e => {
        if (e.key === "Escape") hideDropdown();
    });

    document.addEventListener("click", e => {
        if (!searchBar.contains(e.target)) hideDropdown();
    });
}

// --- Xử lý giao diện ---
function getSearchElements() {
    const searchBar = document.querySelector(".search-bar");
    return {
        input: searchBar ? searchBar.querySelector("input") : null,
        button: searchBar ? searchBar.querySelector("button") : null
    };
}

function getPriceFilterElements() {
    const priceSection = document.querySelector(".filter-section .price-inputs");
    const applyBtn = document.querySelector(".btn-apply");

    if (!priceSection) {
        return { minInput: null, maxInput: null, applyBtn: null };
    }

    const inputs = priceSection.querySelectorAll("input");
    return {
        minInput: inputs[0] || null,
        maxInput: inputs[1] || null,
        applyBtn
    };
}

function getSortValueFromText(text) {
    const normalized = text.trim().toLowerCase();
    if (normalized.includes("giá thấp")) return "price_asc";
    if (normalized.includes("giá cao")) return "price_desc";
    if (normalized.includes("mới")) return "newest";
    return "bestseller"; // Mặc định là bán chạy
}

function setProductCount(count) {
    const title = document.querySelector(".content-header h2");
    if (!title) return;

    const span = title.querySelector("span");
    if (span) {
        span.textContent = `(${count} sản phẩm)`;
    }
}

// --- HÀM HIỂN THỊ SẢN PHẨM TRANG CHỦ (ĐÃ CHỈNH SỬA THEO MẪU MỚI) ---
function renderProducts(products) {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    setProductCount(products.length);

    if (!products.length) {
        productList.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; padding: 50px;">
                Không có sản phẩm phù hợp.
            </p>
        `;
        return;
    }

    productList.innerHTML = products.map((product) => {
        const id = product.id; 
        const safeId = escapeHtml(String(id ?? ""));
        const title = escapeHtml(product.title || "");
        const brand = escapeHtml(product.brand || "");
        const thumbnail = escapeHtml(product.thumbnail || "images/icon-logo.png");
        const currentPrice = formatPrice(product.current_price);
        const oldPrice = parsePrice(product.old_price) > 0 ? formatPrice(product.old_price) : "";

        // CHỈ HIỂN THỊ NHÃN NẾU ADMIN NHẬP
        let discountBadgeHTML = "";
        const rawDiscount = product.discount || "";
        const lowerDiscount = rawDiscount.toLowerCase();

        if (rawDiscount) {
            if (lowerDiscount.includes("bán chạy") || lowerDiscount.includes("hot")) {
                discountBadgeHTML = `<span class="discount-badge" style="background: linear-gradient(90deg, #ff416c, #ff4b2b);"><i class="fas fa-fire"></i> ${escapeHtml(rawDiscount)}</span>`;
            } else {
                discountBadgeHTML = `<span class="discount-badge">${escapeHtml(rawDiscount)}</span>`;
            }
        }

        // RENDER HTML THEO FORMAT MỚI
        return `
            <div class="product-card" data-product-id="${safeId}">
                ${discountBadgeHTML}
                
                <button class="btn-wishlist" type="button" aria-label="Yêu thích">
                    <i class="fa-regular fa-heart"></i>
                </button>

                <div class="product-img-wrapper">
                    <img
                        class="product-img"
                        src="${thumbnail}"
                        alt="${title}"
                        onerror="this.src='images/icon-logo.png'"
                    >
                </div>

                <div class="product-info">
                    <div class="brand">${brand}</div>
                    <div class="product-title" title="${title}">${title}</div>

                    <div class="price-group">
                        <span class="current-price">${currentPrice}</span>
                        ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
                    </div>

                    <button class="btn-buy-now" type="button" data-product-id="${safeId}">
                        <i class="fa-solid fa-cart-shopping"></i> MUA NGAY
                    </button>
                </div>
            </div>
        `;
    }).join("");

    bindProductCardClickEvents(productList);
}

function openProductDetail(productId) {
    const id = String(productId ?? "").trim();
    if (!id) return;
    window.location.href = `product-detail.html?id=${encodeURIComponent(id)}`;
}

function bindProductCardClickEvents(productList) {
    if (!productList || productList.dataset.navigationBound === "true") return;
    productList.dataset.navigationBound = "true";

    productList.addEventListener("click", function(event) {
        const wishlist = event.target.closest(".btn-wishlist");
        if (wishlist) {
            event.preventDefault();
            event.stopPropagation();
            wishlist.classList.toggle("active");
            return;
        }

        const card = event.target.closest(".product-card");
        if (!card || !productList.contains(card)) return;

        const id = card.dataset.productId;
        if (id) openProductDetail(id);
    });
}


function getDisplayOrder(item) {
    const raw = item && (item.display_order ?? item.sort_order ?? item.position);
    const number = Number(raw);
    if (Number.isFinite(number) && number > 0) return number;

    // Nếu dữ liệu cũ chưa có display_order, giữ nguyên thứ tự API trả về để không làm đảo lộn sản phẩm.
    const apiIndex = Number(item && item.__api_index);
    return 999999 + (Number.isFinite(apiIndex) ? apiIndex : 0);
}

// --- Logic lọc và sắp xếp tự động ---
function applyClientFilters() {
    let products = [...state.allProducts];

    if (state.search) {
        products = products.filter((item) => productMatchesSearch(item, state.search));
    }

    if (state.category && state.category !== "all") {
        products = products.filter((item) => productMatchesCategory(item, state.category));
    }

    if (state.selectedBrands.size > 0) {
        products = products.filter((item) => state.selectedBrands.has(item.brand));
    }

    if (state.minPrice !== null) {
        products = products.filter((item) => parsePrice(item.current_price) >= state.minPrice);
    }

    if (state.maxPrice !== null) {
        products = products.filter((item) => parsePrice(item.current_price) <= state.maxPrice);
    }

    // THUẬT TOÁN ĐIỀU KHIỂN TAB
    if (state.sort === "price_asc") {
        products.sort((a, b) => parsePrice(a.current_price) - parsePrice(b.current_price));
    } else if (state.sort === "price_desc") {
        products.sort((a, b) => parsePrice(b.current_price) - parsePrice(a.current_price));
    } else if (state.sort === "newest") {
        products.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (state.sort === "bestseller") {
        products.sort((a, b) => {
            const aHasOrder = hasDisplayOrder(a);
            const bHasOrder = hasDisplayOrder(b);
            const orderA = getDisplayOrder(a);
            const orderB = getDisplayOrder(b);

            // Tab mặc định trên trang chủ ưu tiên đúng thứ tự admin đã kéo thả.
            // Nếu backend đã có display_order, mọi thiết bị sẽ hiển thị giống admin.
            if (aHasOrder || bHasOrder) {
                if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
                if (orderA !== orderB) return orderA - orderB;
            }

            const aIsBest = (a.discount || "").toLowerCase().includes("bán chạy") ? 1 : 0;
            const bIsBest = (b.discount || "").toLowerCase().includes("bán chạy") ? 1 : 0;

            if (aIsBest !== bIsBest) return bIsBest - aIsBest;

            const soldA = parseFloat((a.sold_text || "0").replace(/[^\d.]/g, '')) || 0;
            const soldB = parseFloat((b.sold_text || "0").replace(/[^\d.]/g, '')) || 0;

            if (soldA !== soldB) return soldB - soldA;

            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }

    state.filteredProducts = products;
    renderProducts(products);
}

// --- Bộ lọc thương hiệu động ---
function renderBrandFilters(products) {
    const filterSections = document.querySelectorAll(".filter-section");
    const brandSection = document.querySelector('[data-filter="brand"]') || filterSections[1];
    if (!brandSection) return;
    const title = brandSection.querySelector("h3");
    brandSection.innerHTML = "";
    if (title) brandSection.appendChild(title);

    const brandsMap = new Map();
    products.forEach((item) => {
        const brand = (item.brand || "").trim();
        if (!brand) return;
        brandsMap.set(brand, (brandsMap.get(brand) || 0) + 1);
    });

    const sortedBrands = [...brandsMap.entries()].sort((a, b) => a[0].localeCompare(b[0], "vi"));

    sortedBrands.forEach(([brand, count]) => {
        const label = document.createElement("label");
        label.innerHTML = `
            <input type="checkbox" value="${brand}">
            ${brand} (${count})
        `;

        const checkbox = label.querySelector("input");
        checkbox.checked = state.selectedBrands.has(brand);

        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                state.selectedBrands.add(brand);
            } else {
                state.selectedBrands.delete(brand);
            }
            applyClientFilters();
        });

        brandSection.appendChild(label);
    });

    setupMobileFilterCompact();
}


// =========================================================
// MOBILE FILTER COMPACT: Thu gọn Khoảng giá / Thương hiệu
// =========================================================
function markHomeProductsPage() {
    if (document.getElementById("product-list")) {
        document.body.classList.add("home-products-page");
    }
}

function setupMobileFilterCompact() {
    const isMobile = window.innerWidth <= 768;
    const sections = document.querySelectorAll(".sidebar .filter-section");

    sections.forEach((section, index) => {
        const title = section.querySelector("h3");
        if (!title) return;

        let content = section.querySelector(".filter-content");

        // Bọc phần nội dung bên dưới tiêu đề vào .filter-content để mobile có thể mở/đóng
        if (!content) {
            content = document.createElement("div");
            content.className = "filter-content";

            const children = [...section.children].filter(el => el.tagName !== "H3");
            children.forEach(el => content.appendChild(el));
            section.appendChild(content);
        }

        if (isMobile) {
            // Mặc định mở Khoảng giá, đóng Thương hiệu để trang gọn hơn
            if (!section.dataset.mobileInit) {
                section.classList.toggle("open", index === 0);
                section.dataset.mobileInit = "true";
            }

            if (!title.dataset.boundClick) {
                title.dataset.boundClick = "true";
                title.addEventListener("click", function () {
                    if (window.innerWidth <= 768) {
                        section.classList.toggle("open");
                    }
                });
            }
        } else {
            section.classList.remove("open");
            section.dataset.mobileInit = "";
        }
    });

    // Danh sách thương hiệu: mobile hiển thị 2 cột + chỉ hiện 6 brand đầu
    const brandSection = document.querySelector('[data-filter="brand"]') || sections[1];
    if (!brandSection) return;

    const content = brandSection.querySelector(".filter-content");
    if (!content) return;

    content.classList.add("brand-list");
    const labels = content.querySelectorAll("label");
    let btn = brandSection.querySelector(".btn-show-more-brands");

    if (isMobile && labels.length > 6) {
        content.classList.add("compact");

        if (!btn) {
            btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn-show-more-brands";
            btn.textContent = "Xem thêm thương hiệu";
            brandSection.appendChild(btn);

            btn.addEventListener("click", function () {
                content.classList.toggle("expanded");
                btn.textContent = content.classList.contains("expanded") ? "Thu gọn" : "Xem thêm thương hiệu";
            });
        }
    } else {
        content.classList.remove("compact", "expanded");
        if (btn) btn.remove();
    }
}

// --- Gọi API lấy dữ liệu (Đã tích hợp Caching & Skeleton chống lưu cache cũ) ---
async function loadProducts() {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    // Xóa cache cũ nếu trình duyệt đã từng lưu phiên bản trước đó.
    // Việc này giúp sau khi admin đổi thứ tự, trang chủ tải lại sẽ lấy thứ tự mới từ server ngay.
    try {
        sessionStorage.removeItem('morachi_products_cache');
        sessionStorage.removeItem('morachi_products_cache_time');
    } catch (e) {}

    productList.innerHTML = Array(8).fill(`
        <div class="skel-card">
            <div class="skeleton skel-img-home"></div>
            <div class="skeleton skel-line"></div>
            <div class="skeleton skel-line short"></div>
            <div class="skeleton skel-price-home" style="margin-top:20px;"></div>
        </div>
    `).join('');

    try {
        const response = await fetch(`${API_BASE_URL}/products?t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });
        if (!response.ok) throw new Error(`API lỗi: ${response.status}`);

        const products = await response.json();
        state.allProducts = normalizeProductsFromApi(products);

        const params = new URLSearchParams(window.location.search);
        const searchFromUrl = params.get("search");
        const categoryFromUrl = params.get("category");
        if (searchFromUrl && !state.search) {
            state.search = searchFromUrl.trim();
            const { input } = getSearchElements();
            if (input) input.value = state.search;
        }
        if (categoryFromUrl && MORACHI_CATEGORIES.some(cat => cat.id === categoryFromUrl)) {
            state.category = categoryFromUrl;
        }

        renderCategoryFilters(state.allProducts);
        renderBrandFilters(state.allProducts);
        applyClientFilters(); 
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        productList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 50px; color:red;">Không tải được dữ liệu. Vui lòng tải lại trang.</p>`;
    }
}

// --- Gán sự kiện (Binding) ---
function bindSortTabs() {
    const tabs = document.querySelectorAll(".sort-tabs span");
    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((item) => item.classList.remove("active"));
            tab.classList.add("active");
            state.sort = getSortValueFromText(tab.textContent);
            applyClientFilters();
        });
    });
}

function bindSearch() {
    const { input, button } = getSearchElements();
    if (!input || !button) return;

    const runSearch = () => {
        state.search = input.value.trim();
        applyClientFilters();
    };

    button.addEventListener("click", runSearch);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            runSearch();
        }
    });

    initSmartSearchAutocomplete();
}

function bindPriceFilter() {
    const { minInput, maxInput, applyBtn } = getPriceFilterElements();
    if (!minInput || !maxInput || !applyBtn) return;

    applyBtn.addEventListener("click", () => {
        const min = parsePrice(minInput.value);
        const max = parsePrice(maxInput.value);
        state.minPrice = minInput.value.trim() ? min : null;
        state.maxPrice = maxInput.value.trim() ? max : null;
        applyClientFilters();
    });
}

// --- TÍNH NĂNG NÚT LIÊN HỆ NỔI (FLOATING CONTACT) ---
function initFloatingContact() {
    const style = document.createElement('style');
    style.innerHTML = `
        .floating-contact {
            position: fixed;
            bottom: 30px;
            right: 30px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            z-index: 9999;
        }
        .float-btn {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 22px;
            text-decoration: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
        }
        .float-btn:hover {
            transform: translateY(-5px) scale(1.05);
            color: white;
            box-shadow: 0 6px 15px rgba(0,0,0,0.4);
        }
        .float-btn .tooltip {
            position: absolute;
            right: 55px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 13px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: 0.3s ease;
            pointer-events: none;
            font-weight: bold;
        }
        .float-btn:hover .tooltip {
            opacity: 1;
            visibility: visible;
            right: 60px;
        }
        .btn-messenger { background: linear-gradient(45deg, #00C6FF, #0072FF); }
        .btn-facebook { background: #1877F2; }
        .btn-tiktok1 { background: #000000; border: 2px solid #fff; }
        .btn-tiktok2 { background: #000000; border: 2px solid #00f2fe; }

        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 132, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0); }
        }
        .btn-messenger {
            animation: pulse-ring 2s infinite;
        }

        @media (max-width: 768px) {
            .floating-contact {
                bottom: 20px;
                right: 15px;
                transform: scale(0.9);
                transform-origin: bottom right;
            }
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'floating-contact';
    container.innerHTML = `
        <a href="https://www.facebook.com/profile.php?id=61572066442519" target="_blank" class="float-btn btn-messenger">
            <i class="fab fa-facebook-messenger"></i>
            <span class="tooltip">Chat Messenger</span>
        </a>
        <a href="https://www.facebook.com/profile.php?id=61572066442519" target="_blank" class="float-btn btn-facebook">
            <i class="fab fa-facebook-f"></i>
            <span class="tooltip">Facebook Fanpage</span>
        </a>
        <a href="https://www.tiktok.com/@donhatnoidia2026" target="_blank" class="float-btn btn-tiktok1">
            <i class="fab fa-tiktok"></i>
            <span class="tooltip">Tiệm đồ nhật nội địa</span>
        </a>
        <a href="https://www.tiktok.com/@morachijanpan" target="_blank" class="float-btn btn-tiktok2">
            <i class="fab fa-tiktok"></i>
            <span class="tooltip">Morachi</span>
        </a>
    `;
    document.body.appendChild(container);
}

window.addEventListener("resize", () => {
    setupMobileFilterCompact();
});

// --- Khởi chạy ---
document.addEventListener("DOMContentLoaded", () => {
    markHomeProductsPage();
    bindSortTabs();
    bindSearch();
    bindPriceFilter();
    loadProducts();
    setupMobileFilterCompact();
    initFloatingContact(); 

    document.querySelectorAll('.price-inputs input').forEach(input => {
        input.addEventListener('blur', function() {
            let val = this.value.replace(/[^\d]/g, ''); 
            if (val) {
                let num = parseInt(val, 10);
                if (num > 0 && num < 1000) {
                    num = num * 1000;
                }
                this.value = num.toLocaleString('vi-VN');
            }
        });

        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur(); 
                const applyBtn = document.querySelector('.btn-apply');
                if (applyBtn) applyBtn.click(); 
            }
        });
    });   
});