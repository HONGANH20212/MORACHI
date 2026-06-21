const API_BASE_URL = "/api";

const state = {
    allProducts: [],
    filteredProducts: [],
    selectedBrands: new Set(),
    sort: "bestseller", // Mặc định hiển thị tab Bán chạy
    search: "",
    minPrice: null,
    maxPrice: null
};

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
            <div class="product-card" onclick="window.location.href='product-detail.html?id=${id}'">
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

                    <button class="btn-buy-now" onclick="event.stopPropagation(); window.location.href='product-detail.html?id=${id}'">
                        <i class="fa-solid fa-cart-shopping"></i> MUA NGAY
                    </button>
                </div>
            </div>
        `;
    }).join("");
}


function getDisplayOrder(item) {
    const raw = item.display_order ?? item.sort_order ?? item.position;
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 ? number : 999999;
}

// --- Logic lọc và sắp xếp tự động ---
function applyClientFilters() {
    let products = [...state.allProducts];

    if (state.search) {
        const keyword = state.search.toLowerCase();
        products = products.filter((item) => {
            const title = String(item.title || "").toLowerCase();
            const brand = String(item.brand || "").toLowerCase();
            return title.includes(keyword) || brand.includes(keyword);
        });
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
            const orderA = getDisplayOrder(a);
            const orderB = getDisplayOrder(b);

            // Ưu tiên thứ tự kéo thả từ admin. Số nhỏ hiển thị trước.
            if (orderA !== orderB) return orderA - orderB;

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

    const cacheKey = 'morachi_products_cache';
    const cacheTimeKey = 'morachi_products_cache_time';
    const cachedData = sessionStorage.getItem(cacheKey);
    const cachedTime = sessionStorage.getItem(cacheTimeKey);

    const isCacheValid = cachedData && cachedTime && (new Date().getTime() - parseInt(cachedTime) < 300000);

    if (isCacheValid) {
        try {
            const products = JSON.parse(cachedData);
            state.allProducts = Array.isArray(products) ? products : [];
            renderBrandFilters(state.allProducts);
            applyClientFilters(); 
            return; 
        } catch(e) {
            console.error("Lỗi đọc cache:", e);
        }
    }

    productList.innerHTML = Array(8).fill(`
        <div class="skel-card">
            <div class="skeleton skel-img-home"></div>
            <div class="skeleton skel-line"></div>
            <div class="skeleton skel-line short"></div>
            <div class="skeleton skel-price-home" style="margin-top:20px;"></div>
        </div>
    `).join('');

    try {
        const response = await fetch(`${API_BASE_URL}/products?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`API lỗi: ${response.status}`);

        const products = await response.json();
        
        sessionStorage.setItem(cacheKey, JSON.stringify(products));
        sessionStorage.setItem(cacheTimeKey, new Date().getTime().toString());

        state.allProducts = Array.isArray(products) ? products : [];

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