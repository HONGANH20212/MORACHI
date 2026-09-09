const API_BASE_URL = "/api";

const state = {
    allProducts: [],
    filteredProducts: [],
    selectedBrands: new Set(),
    sort: "bestseller", // Giữ nguyên thuật toán sắp xếp mặc định hiện có
    search: "",
    minPrice: null,
    maxPrice: null,
    // Mặc định KHÔNG lọc theo danh mục để khi vào trang chủ vẫn thấy toàn bộ sản phẩm.
    // Chỉ bắt đầu lọc khi người dùng chủ động chọn Trang Điểm / Chăm sóc da / TPCN / 2highend
    // hoặc chọn danh mục con Mặt / Mắt / Môi / Má / Mày.
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

// Tạo đường dẫn SEO từ tên sản phẩm.
// Ví dụ: "Phấn phủ đa sắc Canmake" -> "phan-phu-da-sac-canmake"
function createProductSlug(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getProductSeoUrl(product) {
    const slug = createProductSlug(product.slug || product.title || "san-pham");
    return `/san-pham/${slug}`;
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
    const homeCount = document.getElementById("home-product-count");
    if (homeCount) {
        homeCount.textContent = `(${count} sản phẩm)`;
        return;
    }

    // Giữ tương thích với giao diện cũ nếu file JS được dùng lại ở nơi khác.
    const title = document.querySelector(".content-header h2");
    if (!title) return;
    const span = title.querySelector("span");
    if (span) span.textContent = `(${count} sản phẩm)`;
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
        const productUrl = getProductSeoUrl(product);
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
            <div class="product-card" onclick="window.location.href='${productUrl}'">
                ${discountBadgeHTML}
                
                <button class="btn-wishlist" onclick="event.stopPropagation(); this.classList.toggle('active');">
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

                    <button class="btn-buy-now" onclick="event.stopPropagation(); window.location.href='${productUrl}'">
                        <i class="fa-solid fa-cart-shopping"></i> MUA NGAY
                    </button>
                </div>
            </div>
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
// DANH MỤC TRANG CHỦ MỚI
// - Không thay đổi API, giỏ hàng, tìm kiếm hay đường dẫn chi tiết sản phẩm.
// - Ưu tiên category/subcategory/is_highend/collections do Admin gán chính xác.
// - Chỉ dùng từ khóa làm fallback cho sản phẩm cũ chưa được phân loại.
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
        product.category,
        product.category_name,
        product.main_category,
        product.subcategory,
        product.sub_category,
        product.product_type,
        product.type,
        product.tags,
        product.title,
        product.brand
    ];
    return normalizeVietnameseText(fields.filter(Boolean).join(" "));
}

function includesAny(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
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
    highend: ["2highend", "highend", "high end", "luxury", "cao cap"]
};

const HOME_SUBCATEGORY_KEYWORDS = {
    face: [
        "kem nen", "foundation", "cushion", "phan phu", "powder", "phan nen", "base",
        "primer", "lot nen", "concealer", "che khuyet", "highlight", "contour", "tao khoi"
    ],
    eyes: ["phan mat", "eye shadow", "eyeshadow", "mascara", "eyeliner", "ke mat", "eye liner"],
    lips: ["son", "lip", "moi", "rouge"],
    cheeks: ["ma hong", "blush", "cheek", "fleur cheeks"],
    brows: ["ke may", "chi may", "eyebrow", "brow", "may"]
};

function normalizeTaxonomyValue(value) {
    return normalizeVietnameseText(value).replace(/\s+/g, " ").trim();
}

function getProductCollections(product) {
    const value = product && product.collections;
    if (Array.isArray(value)) return value.map(normalizeTaxonomyValue).filter(Boolean);
    if (!value) return [];
    return String(value).split(/[,;|]/).map(normalizeTaxonomyValue).filter(Boolean);
}

function productHasExplicitHighend(product) {
    return !!(product && (
        Object.prototype.hasOwnProperty.call(product, "is_highend") ||
        Object.prototype.hasOwnProperty.call(product, "collections")
    ));
}

function productIsHighend(product) {
    if (!product) return false;
    if (product.is_highend === true || String(product.is_highend).toLowerCase() === "true" || Number(product.is_highend) === 1) {
        return true;
    }
    return getProductCollections(product).includes("highend");
}

function productMatchesHomeCategory(product, category) {
    if (!category) return true;

    // 2highend là collection độc lập: sản phẩm vẫn có thể đồng thời là Makeup > Môi/Mặt...
    if (category === "highend") {
        if (productHasExplicitHighend(product)) return productIsHighend(product);
        const text = getProductCategorySource(product);
        return includesAny(text, HOME_CATEGORY_KEYWORDS.highend || []);
    }

    // Ưu tiên taxonomy do Admin đã gán. Chỉ fallback từ khóa cho dữ liệu cũ chưa phân loại.
    const explicitCategory = normalizeTaxonomyValue(product && product.category);
    if (explicitCategory) return explicitCategory === category;

    const text = getProductCategorySource(product);
    return includesAny(text, HOME_CATEGORY_KEYWORDS[category] || []);
}

function productMatchesHomeSubcategory(product, subcategory) {
    if (!subcategory) return true;

    // Khi Admin đã gán danh mục con, dùng giá trị chính xác; dữ liệu cũ mới dùng heuristic.
    const explicitSubcategory = normalizeTaxonomyValue(product && product.subcategory);
    if (explicitSubcategory) return explicitSubcategory === subcategory;

    const text = getProductCategorySource(product);
    return includesAny(text, HOME_SUBCATEGORY_KEYWORDS[subcategory] || []);
}

function getProductsForHomeCategory(products, includeSubcategory = true) {
    let result = [...(products || [])];
    if (state.homeCategory) {
        result = result.filter(product => productMatchesHomeCategory(product, state.homeCategory));
    }
    if (includeSubcategory && state.homeCategory === "makeup" && state.homeSubcategory) {
        result = result.filter(product => productMatchesHomeSubcategory(product, state.homeSubcategory));
    }
    return result;
}

function getHomeSectionTitle() {
    if (state.search) return `KẾT QUẢ TÌM KIẾM`;
    if (!state.homeCategory) return "TẤT CẢ SẢN PHẨM";
    if (state.homeCategory === "skincare") return "CHĂM SÓC DA";
    if (state.homeCategory === "supplement") return "THỰC PHẨM CHỨC NĂNG";
    if (state.homeCategory === "highend") return "2HIGHEND";

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
    document.querySelectorAll(".home-main-category").forEach(button => {
        const active = button.dataset.category === state.homeCategory;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const subcategoryNav = document.getElementById("home-makeup-subcategories");
    if (subcategoryNav) {
        subcategoryNav.classList.toggle("is-hidden", state.homeCategory !== "makeup");
    }

    document.querySelectorAll(".home-subcategory").forEach(button => {
        const active = state.homeCategory === "makeup" && button.dataset.subcategory === state.homeSubcategory;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const sectionTitle = document.getElementById("home-section-title");
    if (sectionTitle) sectionTitle.textContent = getHomeSectionTitle();
}

function renderHomeFeaturedBrands() {
    const container = document.getElementById("home-brand-list");
    if (!container) return;

    let source = getProductsForHomeCategory(state.allProducts, false);
    if (!source.length) source = [...state.allProducts];

    const brands = [];
    const seen = new Set();
    source.forEach(product => {
        const brand = String(product.brand || "").trim();
        if (!brand) return;
        const key = brand.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        brands.push(brand);
    });

    if (!brands.length) {
        container.innerHTML = '<span class="home-brand-placeholder">Chưa có thông tin thương hiệu.</span>';
        return;
    }

    container.innerHTML = brands.slice(0, 8).map(brand => {
        const safeBrand = escapeHtml(brand);
        const active = state.selectedBrands.has(brand) ? " active" : "";
        return `<button type="button" class="home-brand-chip${active}" data-brand="${safeBrand}">${safeBrand}</button>`;
    }).join("");

    container.querySelectorAll(".home-brand-chip").forEach(button => {
        button.addEventListener("click", () => {
            const brand = button.dataset.brand || "";
            if (state.selectedBrands.has(brand)) state.selectedBrands.delete(brand);
            else {
                state.selectedBrands.clear();
                state.selectedBrands.add(brand);
            }
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });
}

function bindHomeCategoryNavigation() {
    document.querySelectorAll(".home-main-category").forEach(button => {
        button.addEventListener("click", () => {
            // Chỉ lọc sau khi người dùng chủ động chọn danh mục.
            // Chọn Trang Điểm chỉ lọc toàn bộ Trang Điểm; không tự ép về Mặt như trước.
            state.homeCategory = button.dataset.category || "";
            state.homeSubcategory = "";
            state.selectedBrands.clear();
            state.search = "";
            const searchInput = getSearchElements().input;
            if (searchInput) searchInput.value = "";
            updateHomeCategoryUI();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });

    document.querySelectorAll(".home-subcategory").forEach(button => {
        button.addEventListener("click", () => {
            state.homeCategory = "makeup";
            state.homeSubcategory = button.dataset.subcategory || "";
            state.selectedBrands.clear();
            state.search = "";
            const searchInput = getSearchElements().input;
            if (searchInput) searchInput.value = "";
            updateHomeCategoryUI();
            renderHomeFeaturedBrands();
            applyClientFilters();
        });
    });

    const showAll = document.getElementById("home-show-all");
    if (showAll) {
        showAll.addEventListener("click", () => {
            // "Xem tất cả" trả trang chủ về đúng trạng thái ban đầu: toàn bộ sản phẩm.
            state.homeCategory = "";
            state.homeSubcategory = "";
            state.selectedBrands.clear();
            state.search = "";
            const searchInput = getSearchElements().input;
            if (searchInput) searchInput.value = "";
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
        // Chỉ áp dụng taxonomy khi người dùng đã chủ động chọn bộ lọc danh mục.
        // Trạng thái ban đầu homeCategory/homeSubcategory rỗng => giữ nguyên toàn bộ sản phẩm như website cũ.
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
    if (document.querySelector('.floating-contact')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        .floating-contact {
            position: fixed;
            right: 30px;
            bottom: 30px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
        }
        .floating-contact-panel {
            display: none;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
        }
        .floating-contact.open .floating-contact-panel {
            display: flex;
        }
        .floating-contact-link {
            min-width: 200px;
            min-height: 44px;
            padding: 10px 16px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: flex-start;
            gap: 10px;
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            line-height: 1.3;
            text-decoration: none;
            box-shadow: 0 10px 24px rgba(16, 22, 30, 0.18);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .floating-contact-link:hover {
            transform: translateY(-2px);
            color: #fff;
            box-shadow: 0 12px 28px rgba(16, 22, 30, 0.24);
        }
        .floating-contact-link i {
            width: 20px;
            text-align: center;
            font-size: 18px;
            flex: 0 0 auto;
        }
        .floating-contact-toggle {
            min-width: 118px;
            height: 48px;
            padding: 0 16px;
            border: 0;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            background: linear-gradient(135deg, #d71920, #b30f16);
            color: #fff;
            font: inherit;
            font-size: 15px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            box-shadow: 0 12px 26px rgba(183, 15, 22, 0.28);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .floating-contact-toggle:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 30px rgba(183, 15, 22, 0.34);
        }
        .floating-contact-toggle i {
            font-size: 18px;
            line-height: 1;
        }
        .floating-contact-toggle .close-label { display: none; }
        .floating-contact.open .floating-contact-toggle .open-label { display: none; }
        .floating-contact.open .floating-contact-toggle .close-label { display: inline; }
        .contact-messenger { background: linear-gradient(45deg, #00C6FF, #0072FF); }
        .contact-tiktok1 { background: #121212; }
        .contact-tiktok2 { background: linear-gradient(45deg, #121212, #202020); border: 1px solid #00f2fe33; }

        @media (max-width: 768px) {
            .floating-contact {
                right: 12px;
                bottom: calc(86px + env(safe-area-inset-bottom));
                gap: 8px;
            }
            .floating-contact-link {
                min-width: 180px;
                min-height: 40px;
                padding: 9px 14px;
                font-size: 13px;
            }
            .floating-contact-toggle {
                min-width: 108px;
                height: 44px;
                padding: 0 14px;
                font-size: 14px;
            }
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'floating-contact';
    container.innerHTML = `
        <div class="floating-contact-panel" id="floating-contact-panel" hidden>
            <a href="https://www.facebook.com/profile.php?id=61572066442519" target="_blank" rel="noopener noreferrer" class="floating-contact-link contact-messenger">
                <i class="fab fa-facebook-messenger" aria-hidden="true"></i>
                <span>Fanpage / Messenger</span>
            </a>
            <a href="https://www.tiktok.com/@donhatnoidia2026" target="_blank" rel="noopener noreferrer" class="floating-contact-link contact-tiktok1">
                <i class="fab fa-tiktok" aria-hidden="true"></i>
                <span>TikTok 1 · Tiệm đồ Nhật nội địa</span>
            </a>
            <a href="https://www.tiktok.com/@morachijanpan" target="_blank" rel="noopener noreferrer" class="floating-contact-link contact-tiktok2">
                <i class="fab fa-tiktok" aria-hidden="true"></i>
                <span>TikTok 2 · Morachi</span>
            </a>
        </div>
        <button type="button" class="floating-contact-toggle" aria-expanded="false" aria-controls="floating-contact-panel" aria-label="Mở liên hệ nhanh">
            <i class="fa-solid fa-comments" aria-hidden="true"></i>
            <span class="open-label">Liên hệ</span>
            <span class="close-label">Đóng</span>
        </button>
    `;
    document.body.appendChild(container);

    const toggle = container.querySelector('.floating-contact-toggle');
    const panel = container.querySelector('.floating-contact-panel');

    function setOpen(open) {
        container.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Đóng liên hệ nhanh' : 'Mở liên hệ nhanh');
        panel.hidden = !open;
    }

    toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setOpen(!container.classList.contains('open'));
    });

    panel.addEventListener('click', (event) => {
        event.stopPropagation();
    });

    document.addEventListener('click', (event) => {
        if (!container.contains(event.target)) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setOpen(false);
    });
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
    bindHomeCategoryNavigation();
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