const API_BASE_URL = "/api";

const state = {
    allProducts: [],
    filteredProducts: [],
    selectedBrands: new Set(),
    sort: "bestseller",
    search: "",
    minPrice: null,
    maxPrice: null,

    // Một nguồn state duy nhất cho cả category bar và mobile filter drawer.
    // home-mobile.js cũng đang đọc/ghi đúng hai field này.
    homeCategory: "",
    homeSubcategory: ""
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

function normalizeSearchText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

function productMatchesMobileCategory(product, category) {
    if (!category || category === "all") return true;

    const explicitCategory = normalizeSearchText(
        product.category ||
        product.category_name ||
        product.product_category ||
        product.type ||
        product.collection ||
        ""
    );

    const searchable = normalizeSearchText([
        product.title,
        product.brand,
        product.description,
        explicitCategory,
        Array.isArray(product.tags) ? product.tags.join(" ") : product.tags
    ].filter(Boolean).join(" "));

    const categoryAliases = {
        makeup: [
            "makeup", "make up", "trang diem", "phan", "foundation",
            "cushion", "lip", "son", "mascara", "eyeliner", "blush",
            "concealer", "powder"
        ],
        skincare: [
            "skincare", "skin care", "cham soc da", "duong da",
            "mat na", "serum", "toner", "cleanser", "sua rua mat",
            "kem duong", "chong nang", "sunscreen"
        ],
        perfume: [
            "perfume", "fragrance", "nuoc hoa", "eau de",
            "parfum", "cologne"
        ]
    };

    return (categoryAliases[category] || []).some((keyword) =>
        searchable.includes(keyword)
    );
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
    // Giao diện homepage hiện tại dùng #home-product-count.
    const homeCount = document.getElementById("home-product-count");
    if (homeCount) {
        homeCount.textContent = `(${count} sản phẩm)`;
    }

    // Giữ tương thích với layout cũ nếu script được dùng lại.
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
            <div class="product-empty-state">
                <i class="fa-solid fa-magnifying-glass"></i>
                <strong>Không tìm thấy sản phẩm phù hợp</strong>
                <span>Thử chọn danh mục khác hoặc thay đổi từ khóa tìm kiếm.</span>
            </div>
        `;
        return;
    }

    productList.innerHTML = products.map((product) => {
        const id = encodeURIComponent(String(product.id ?? ""));
        const title = escapeHtml(product.title || "");
        const brand = escapeHtml(product.brand || "");
        const thumbnail = escapeHtml(product.thumbnail || "images/icon-logo.png");
        const currentPrice = formatPrice(product.current_price);
        const oldPrice = parsePrice(product.old_price) > 0
            ? formatPrice(product.old_price)
            : "";

        const numericRating = Number.parseFloat(product.rating);
        const rating = Number.isFinite(numericRating)
            ? Math.min(5, Math.max(0, numericRating)).toFixed(1)
            : "4.9";

        let discountBadgeHTML = "";
        const rawDiscount = String(product.discount || "").trim();
        const lowerDiscount = rawDiscount.toLowerCase();

        if (rawDiscount) {
            if (lowerDiscount.includes("bán chạy") || lowerDiscount.includes("hot")) {
                discountBadgeHTML = `
                    <span class="discount-badge discount-badge-hot">
                        ${escapeHtml(rawDiscount)}
                    </span>
                `;
            } else {
                discountBadgeHTML = `
                    <span class="discount-badge">
                        ${escapeHtml(rawDiscount)}
                    </span>
                `;
            }
        }

        const detailUrl = `product-detail.html?id=${id}`;

        return `
            <article
                class="product-card"
                tabindex="0"
                role="link"
                aria-label="Xem ${title}"
                onclick="window.location.href='${detailUrl}'"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.location.href='${detailUrl}';}"
            >
                ${discountBadgeHTML}

                <button
                    type="button"
                    class="btn-wishlist"
                    aria-label="Yêu thích ${title}"
                    aria-pressed="false"
                    onclick="event.stopPropagation(); this.classList.toggle('active'); this.setAttribute('aria-pressed', this.classList.contains('active') ? 'true' : 'false');"
                >
                    <i class="fa-regular fa-heart"></i>
                </button>

                <div class="product-img-wrapper">
                    <img
                        class="product-img"
                        src="${thumbnail}"
                        alt="${title}"
                        loading="lazy"
                        decoding="async"
                        onerror="this.onerror=null;this.src='images/icon-logo.png'"
                    >
                </div>

                <div class="product-info">
                    <div class="brand">${brand}</div>
                    <div class="product-title" title="${title}">${title}</div>

                    <div class="product-purchase-row">
                        <div class="product-price-meta">
                            <div class="price-group">
                                <span class="current-price">${currentPrice}</span>
                                ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
                            </div>

                            <div class="product-mobile-rating" aria-label="${rating} trên 5 sao">
                                <i class="fa-solid fa-star"></i>
                                <span>${rating}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="btn-buy-now"
                            aria-label="Xem sản phẩm ${title}"
                            onclick="event.stopPropagation(); window.location.href='${detailUrl}'"
                        >
                            <i class="fa-solid fa-cart-shopping"></i>
                            <span>MUA NGAY</span>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }).join("");
}


function getDisplayOrder(item) {
    const raw = item && (item.display_order ?? item.sort_order ?? item.position);
    const number = Number(raw);
    if (Number.isFinite(number) && number > 0) return number;

    // Nếu dữ liệu cũ chưa có display_order, giữ nguyên thứ tự API trả về để không làm đảo lộn sản phẩm.
    const apiIndex = Number(item && item.__api_index);
    return 999999 + (Number.isFinite(apiIndex) ? apiIndex : 0);
}


// =========================================================
// TAXONOMY / DANH MỤC TRANG CHỦ
// Đồng bộ với index.html + home-mobile.js hiện tại.
// =========================================================
function normalizeVietnameseText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
}

function getProductCategorySource(product) {
    const fields = [
        product && product.category,
        product && product.category_name,
        product && product.main_category,
        product && product.subcategory,
        product && product.sub_category,
        product && product.product_type,
        product && product.type,
        product && product.tags,
        product && product.title,
        product && product.brand
    ];

    return normalizeVietnameseText(fields.filter(Boolean).join(" "));
}

function includesAny(text, keywords) {
    return (keywords || []).some((keyword) => text.includes(keyword));
}

const HOME_CATEGORY_KEYWORDS = {
    makeup: [
        "trang diem", "makeup", "phan", "son", "lip", "eye", "mascara",
        "eyeliner", "ke mat", "ke may", "eyebrow", "brow", "ma hong", "blush",
        "cushion", "kem nen", "foundation", "concealer", "che khuyet", "highlight",
        "primer", "base makeup", "powder", "cheek"
    ],
    skincare: [
        "cham soc da", "skincare", "sua rua mat", "rua mat", "cleanser", "cleansing",
        "tay trang", "toner", "lotion", "serum", "essence", "duong da", "duong am",
        "moistur", "cream", "kem duong", "chong nang", "sunscreen", "mat na", "mask"
    ],
    supplement: [
        "thuc pham chuc nang", "supplement", "vien uong", "vitamin", "collagen", "dha",
        "omega", "canxi", "calcium", "probiotic", "enzyme", "kem zinc", "zinc", "sat iron"
    ],
    highend: [
        "2highend", "highend", "high end", "luxury", "cao cap"
    ]
};

const HOME_SUBCATEGORY_KEYWORDS = {
    face: [
        "kem nen", "foundation", "cushion", "phan phu", "powder", "phan nen", "base",
        "primer", "lot nen", "concealer", "che khuyet", "highlight", "contour", "tao khoi"
    ],
    eyes: [
        "phan mat", "eye shadow", "eyeshadow", "mascara", "eyeliner", "ke mat", "eye liner"
    ],
    lips: [
        "son", "lip", "moi", "rouge"
    ],
    cheeks: [
        "ma hong", "blush", "cheek", "fleur cheeks"
    ],
    brows: [
        "ke may", "chi may", "eyebrow", "brow", "may"
    ]
};

function normalizeTaxonomyValue(value) {
    return normalizeVietnameseText(value).replace(/\s+/g, " ").trim();
}

function getProductCollections(product) {
    const value = product && product.collections;
    if (Array.isArray(value)) {
        return value.map(normalizeTaxonomyValue).filter(Boolean);
    }
    if (!value) return [];
    return String(value)
        .split(/[,;|]/)
        .map(normalizeTaxonomyValue)
        .filter(Boolean);
}

function productHasExplicitHighend(product) {
    return !!(
        product &&
        (
            Object.prototype.hasOwnProperty.call(product, "is_highend") ||
            Object.prototype.hasOwnProperty.call(product, "collections")
        )
    );
}

function productIsHighend(product) {
    if (!product) return false;

    if (
        product.is_highend === true ||
        String(product.is_highend).toLowerCase() === "true" ||
        Number(product.is_highend) === 1
    ) {
        return true;
    }

    return getProductCollections(product).includes("highend");
}

function productMatchesHomeCategory(product, category) {
    if (!category) return true;

    if (category === "highend") {
        if (productHasExplicitHighend(product)) {
            return productIsHighend(product);
        }

        return includesAny(
            getProductCategorySource(product),
            HOME_CATEGORY_KEYWORDS.highend
        );
    }

    // Ưu tiên taxonomy do admin lưu vào API.
    const explicitCategory = normalizeTaxonomyValue(product && product.category);
    if (explicitCategory) {
        return explicitCategory === category;
    }

    // Fallback cho dữ liệu cũ chưa có category chuẩn.
    return includesAny(
        getProductCategorySource(product),
        HOME_CATEGORY_KEYWORDS[category]
    );
}

function productMatchesHomeSubcategory(product, subcategory) {
    if (!subcategory) return true;

    const explicitSubcategory = normalizeTaxonomyValue(
        product && product.subcategory
    );

    if (explicitSubcategory) {
        return explicitSubcategory === subcategory;
    }

    return includesAny(
        getProductCategorySource(product),
        HOME_SUBCATEGORY_KEYWORDS[subcategory]
    );
}

function getProductsForHomeCategory(products, includeSubcategory = true) {
    let result = [...(products || [])];

    if (state.homeCategory) {
        result = result.filter((product) =>
            productMatchesHomeCategory(product, state.homeCategory)
        );
    }

    if (
        includeSubcategory &&
        state.homeCategory === "makeup" &&
        state.homeSubcategory
    ) {
        result = result.filter((product) =>
            productMatchesHomeSubcategory(product, state.homeSubcategory)
        );
    }

    return result;
}

function getHomeSectionTitle() {
    if (state.search) return "KẾT QUẢ TÌM KIẾM";
    if (!state.homeCategory) return "TẤT CẢ SẢN PHẨM";
    if (state.homeCategory === "skincare") return "CHĂM SÓC DA";
    if (state.homeCategory === "supplement") return "THỰC PHẨM CHỨC NĂNG";
    if (state.homeCategory === "highend") return "LUXURY";

    const labels = {
        face: "TRANG ĐIỂM CHO MẶT",
        eyes: "TRANG ĐIỂM CHO MẮT",
        lips: "TRANG ĐIỂM CHO MÔI",
        cheeks: "TRANG ĐIỂM CHO MÁ",
        brows: "TRANG ĐIỂM CHO MÀY"
    };

    return labels[state.homeSubcategory] || "TRANG ĐIỂM";
}

function updateHomeCategoryUI() {
    document.querySelectorAll(".home-main-category").forEach((button) => {
        const active =
            (button.dataset.category || "") === (state.homeCategory || "");

        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const subcategoryNav = document.getElementById("home-makeup-subcategories");
    if (subcategoryNav) {
        subcategoryNav.classList.toggle(
            "is-hidden",
            state.homeCategory !== "makeup"
        );
    }

    document.querySelectorAll(".home-subcategory").forEach((button) => {
        const active =
            state.homeCategory === "makeup" &&
            (button.dataset.subcategory || "") === (state.homeSubcategory || "");

        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const sectionTitle = document.getElementById("home-section-title");
    if (sectionTitle) {
        sectionTitle.textContent = getHomeSectionTitle();
    }
}

function renderHomeFeaturedBrands() {
    const container = document.getElementById("home-brand-list");
    if (!container) return;

    let source = getProductsForHomeCategory(state.allProducts, false);
    if (!source.length) {
        source = [...state.allProducts];
    }

    const brands = [];
    const seen = new Set();

    source.forEach((product) => {
        const brand = String(product.brand || "").trim();
        if (!brand) return;

        const key = normalizeVietnameseText(brand);
        if (seen.has(key)) return;

        seen.add(key);
        brands.push(brand);
    });

    if (!brands.length) {
        container.innerHTML =
            '<span class="home-brand-placeholder">Chưa có thông tin thương hiệu.</span>';
        return;
    }

    container.innerHTML = brands.slice(0, 8).map((brand) => {
        const safeBrand = escapeHtml(brand);
        const active = state.selectedBrands.has(brand) ? " active" : "";

        return `
            <button
                type="button"
                class="home-brand-chip${active}"
                data-brand="${safeBrand}"
            >${safeBrand}</button>
        `;
    }).join("");

    container.querySelectorAll(".home-brand-chip").forEach((button) => {
        button.addEventListener("click", () => {
            const brand = button.dataset.brand || "";

            if (state.selectedBrands.has(brand)) {
                state.selectedBrands.delete(brand);
            } else {
                state.selectedBrands.clear();
                state.selectedBrands.add(brand);
            }

            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });
}

function bindHomeCategoryNavigation() {
    document.querySelectorAll(".home-main-category").forEach((button) => {
        button.addEventListener("click", () => {
            state.homeCategory = button.dataset.category || "";
            state.homeSubcategory = "";
            state.selectedBrands.clear();
            state.search = "";

            const searchInput = getSearchElements().input;
            if (searchInput) {
                searchInput.value = "";
            }

            updateHomeCategoryUI();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });

    document.querySelectorAll(".home-subcategory").forEach((button) => {
        button.addEventListener("click", () => {
            state.homeCategory = "makeup";
            state.homeSubcategory = button.dataset.subcategory || "";
            state.selectedBrands.clear();
            state.search = "";

            const searchInput = getSearchElements().input;
            if (searchInput) {
                searchInput.value = "";
            }

            updateHomeCategoryUI();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });

    const showAll = document.getElementById("home-show-all");
    if (showAll) {
        showAll.addEventListener("click", () => {
            state.homeCategory = "";
            state.homeSubcategory = "";
            state.selectedBrands.clear();
            state.search = "";

            const searchInput = getSearchElements().input;
            if (searchInput) {
                searchInput.value = "";
            }

            updateHomeCategoryUI();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    }

    const clearBrand = document.getElementById("home-clear-brand");
    if (clearBrand) {
        clearBrand.addEventListener("click", () => {
            state.selectedBrands.clear();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    }

    updateHomeCategoryUI();
}

// --- Logic lọc và sắp xếp tự động ---
function applyClientFilters() {
    let products = [...state.allProducts];

    if (state.search) {
        const keyword = normalizeVietnameseText(state.search);

        products = products.filter((item) => {
            const title = normalizeVietnameseText(item.title || "");
            const brand = normalizeVietnameseText(item.brand || "");

            return title.includes(keyword) || brand.includes(keyword);
        });
    } else if (state.homeCategory || state.homeSubcategory) {
        products = getProductsForHomeCategory(products, true);
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
    updateHomeCategoryUI();
    renderProducts(products);
}

// --- Bộ lọc thương hiệu động ---
function renderBrandFilters(products) {
    const filterSections = document.querySelectorAll(".filter-section");
    if (filterSections.length < 2) return;

    const brandSection = filterSections[1];
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
    const brandSection = sections[1];
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

        renderBrandFilters(state.allProducts);
        renderHomeFeaturedBrands();
        applyClientFilters(); 
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        productList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 50px; color:red;">Không tải được dữ liệu. Vui lòng tải lại trang.</p>`;
    }
}

// --- Gán sự kiện (Binding) ---
function setSortMode(sortValue) {
    state.sort = sortValue;

    document.querySelectorAll(".sort-tabs span").forEach((tab) => {
        tab.classList.toggle(
            "active",
            getSortValueFromText(tab.textContent) === sortValue
        );
    });

    document.querySelectorAll(".mobile-sort-options [data-sort]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.sort === sortValue
        );
    });

    applyClientFilters();
}

function bindSortTabs() {
    document.querySelectorAll(".sort-tabs span").forEach((tab) => {
        tab.addEventListener("click", () => {
            setSortMode(getSortValueFromText(tab.textContent));
        });
    });

    document.querySelectorAll(".mobile-sort-options [data-sort]").forEach((button) => {
        button.addEventListener("click", () => {
            setSortMode(button.dataset.sort || "bestseller");
        });
    });
}

function bindMobileCategories() {
    // Giữ tên hàm cũ để không ảnh hưởng phần khởi tạo,
    // nhưng dùng logic taxonomy mới tương thích với HTML hiện tại.
    bindHomeCategoryNavigation();
}

function setMobileFilterOpen(open) {
    const shouldOpen = Boolean(open);
    const openButton = document.getElementById("mobile-filter-open");
    const drawer = document.getElementById("mobile-filter-drawer");

    document.body.classList.toggle("mobile-filter-open", shouldOpen);

    if (openButton) {
        openButton.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
    }

    if (drawer) {
        drawer.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    }
}

function bindMobileFilterDrawer() {
    const openButton = document.getElementById("mobile-filter-open");
    const closeButton = document.getElementById("mobile-filter-close");
    const backdrop = document.getElementById("mobile-filter-backdrop");

    if (openButton) {
        openButton.addEventListener("click", () => setMobileFilterOpen(true));
    }

    if (closeButton) {
        closeButton.addEventListener("click", () => setMobileFilterOpen(false));
    }

    if (backdrop) {
        backdrop.addEventListener("click", () => setMobileFilterOpen(false));
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && document.body.classList.contains("mobile-filter-open")) {
            setMobileFilterOpen(false);
        }
    });
}

function bindMobileBottomNavigation() {
    const categoriesButton = document.getElementById("mobile-bottom-categories");

    if (categoriesButton) {
        categoriesButton.addEventListener("click", () => {
            const categoryBar = document.getElementById("mobile-category-bar");
            if (categoryBar) {
                categoryBar.scrollLeft = 0;
                categoryBar.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }
}

function bindSearch() {
    const { input, button } = getSearchElements();
    if (!input || !button) return;

    const runSearch = () => {
        state.search = input.value.trim();
        state.selectedBrands.clear();
        renderHomeFeaturedBrands();
        applyClientFilters();
    };

    button.addEventListener("click", runSearch);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            runSearch();
        }
    });
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

    if (window.innerWidth > 768) {
        setMobileFilterOpen(false);
    }
});

// --- Khởi chạy ---
document.addEventListener("DOMContentLoaded", () => {
    markHomeProductsPage();
    bindSortTabs();
    bindMobileCategories();
    bindMobileFilterDrawer();
    bindMobileBottomNavigation();
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