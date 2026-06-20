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

// --- HÀM HIỂN THỊ SẢN PHẨM TRANG CHỦ ---
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
        const rating = escapeHtml(product.rating || "4.9");
        const soldText = escapeHtml(product.sold_text || "1k/tháng");

        // 1. CHỈ HIỂN THỊ NHÃN NẾU ADMIN NHẬP (VD: Bán chạy, -50%)
        let discountBadgeHTML = "";
        const rawDiscount = product.discount || "";
        const lowerDiscount = rawDiscount.toLowerCase();

        if (rawDiscount) {
            // Nếu admin nhập chữ "bán chạy" hoặc "hot" thì cho nền cam gradient + icon Lửa
            if (lowerDiscount.includes("bán chạy") || lowerDiscount.includes("hot")) {
                discountBadgeHTML = `<span class="discount-badge" style="background: linear-gradient(90deg, #ff416c, #ff4b2b);"><i class="fas fa-fire"></i> ${escapeHtml(rawDiscount)}</span>`;
            } else {
                // Các trường hợp khác (như -20%) thì giữ nền đỏ bình thường
                discountBadgeHTML = `<span class="discount-badge">${escapeHtml(rawDiscount)}</span>`;
            }
        }

        // 2. TÍNH TOÁN SỐ LƯỢNG TEXT BÊN DƯỚI (Không tạo nhãn đè ảnh)
        const variants = product.variants || [];
        let totalInstock = 0;
        let hasOrder = false;
        let hasInstock = false;

        if (variants.length > 0) {
            variants.forEach(v => {
                if (v.status === 'instock') {
                    totalInstock += (parseInt(v.stock) || 0);
                    hasInstock = true;
                }
                if (v.status === 'order') {
                    hasOrder = true;
                }
            });
        }

        let stockHTML = "";
        if (hasInstock) {
            stockHTML = `<div style="font-size: 12px; color: #27ae60; font-weight: bold; margin-bottom: 5px;">Số lượng: ${totalInstock}</div>`;
        } else if (hasOrder) {
            stockHTML = `<div style="font-size: 12px; color: #e74c3c; font-weight: bold; margin-bottom: 5px;">Số lượng: NULL</div>`;
        } else {
            stockHTML = `<div style="font-size: 12px; color: #999; font-weight: bold; margin-bottom: 5px;">Hết hàng</div>`;
        }

        return `
            <div class="product-card" onclick="window.location.href='product-detail.html?id=${id}'" style="cursor:pointer;">
                ${discountBadgeHTML}
                
                <img
                    class="product-img"
                    src="${thumbnail}"
                    alt="${title}"
                    onerror="this.src='images/icon-logo.png'"
                >
                <div class="product-info">
                    <div class="brand">${brand}</div>
                    <div class="product-title" title="${title}">${title}</div>
                    
                    ${stockHTML}

                    <div class="price-group">
                        <span class="current-price">${currentPrice}</span>
                        ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
                    </div>
                    <div class="product-rating">
                        <span class="stars">★ ${rating}</span>
                        <span>Đã bán ${soldText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");
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
        // Mới nhất: Tự động sắp xếp thời gian tạo giảm dần
        products.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (state.sort === "bestseller") {
        // Bán chạy: Ưu tiên nhãn "bán chạy" trước, sau đó tới số lượng đã bán
        products.sort((a, b) => {
            const aIsBest = (a.discount || "").toLowerCase().includes("bán chạy") ? 1 : 0;
            const bIsBest = (b.discount || "").toLowerCase().includes("bán chạy") ? 1 : 0;
            
            if (aIsBest !== bIsBest) return bIsBest - aIsBest; // Đẩy nhãn Bán chạy lên Top 1
            
            const soldA = parseFloat((a.sold_text || "0").replace(/[^\d.]/g, '')) || 0;
            const soldB = parseFloat((b.sold_text || "0").replace(/[^\d.]/g, '')) || 0;
            return soldB - soldA; // Xếp hạng theo Lượt bán
        });
    }

    state.filteredProducts = products;
    renderProducts(products);
}

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
}

async function loadProducts() {
    const productList = document.getElementById("product-list");
    if (!productList) return;

    // 1. KIỂM TRA BỘ NHỚ ĐỆM (CACHE)
    const cacheKey = 'morachi_products_cache';
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
        try {
            const products = JSON.parse(cachedData);
            state.allProducts = Array.isArray(products) ? products : [];
            renderBrandFilters(state.allProducts);
            applyClientFilters(); // Render ngay lập tức không cần xoay loading
            return; 
        } catch(e) {}
    }

    // 2. NẾU CHƯA CÓ CACHE -> HIỆN KHUNG XƯƠNG VÀ CALL API
    productList.innerHTML = Array(8).fill(`
        <div class="skel-card">
            <div class="skeleton skel-img-home"></div>
            <div class="skeleton skel-line"></div>
            <div class="skeleton skel-line short"></div>
            <div class="skeleton skel-price-home" style="margin-top:20px;"></div>
        </div>
    `).join('');

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) throw new Error(`API lỗi: ${response.status}`);

        const products = await response.json();
        
        // Lưu vào bộ nhớ đệm để tái sử dụng
        sessionStorage.setItem(cacheKey, JSON.stringify(products));

        state.allProducts = Array.isArray(products) ? products : [];

        renderBrandFilters(state.allProducts);
        applyClientFilters(); 
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        productList.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 50px; color:red;">Không tải được dữ liệu. Vui lòng tải lại trang.</p>`;
    }
}

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

function initFloatingContact() {
    // 1. Gắn CSS động
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

        /* Hoạt ảnh nhấp nháy thu hút sự chú ý cho nút Messenger */
        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 132, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0); }
        }
        .btn-messenger {
            animation: pulse-ring 2s infinite;
        }

        /* Responsive Mobile */
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

    // 2. Gắn HTML động
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

// --- Khởi chạy ---
document.addEventListener("DOMContentLoaded", () => {
    bindSortTabs();
    bindSearch();
    bindPriceFilter();
    loadProducts();
    initFloatingContact(); // Gọi hàm tạo nút liên hệ nổi
    
    // ==============================================================
    // TÙY CHỈNH UX BỘ LỌC GIÁ (TỰ ĐỘNG THÊM 3 SỐ 0)
    // ==============================================================
    document.querySelectorAll('.price-inputs input').forEach(input => {
        // Tự động format khi click chuột ra ngoài
        input.addEventListener('blur', function() {
            let val = this.value.replace(/[^\d]/g, ''); // Lọc lấy số
            if (val) {
                let num = parseInt(val, 10);
                
                // Nếu nhập dưới 1000, tự nhân lên 1000
                if (num > 0 && num < 1000) {
                    num = num * 1000;
                }
                
                // Trả lại format hiển thị
                this.value = num.toLocaleString('vi-VN');
            }
        });

        // Gõ Enter tự động chạy luôn lọc giá
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                this.blur(); // Chạy hàm format ở trên
                const applyBtn = document.querySelector('.btn-apply');
                if (applyBtn) applyBtn.click(); // Kích hoạt nút Áp Dụng
            }
        });
    });   
});