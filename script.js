const API_BASE_URL = "http://localhost:7071/api";

const state = {
    allProducts: [],
    filteredProducts: [],
    selectedBrands: new Set(),
    sort: "created_desc",
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
    if (normalized.includes("mới nhất")) return "created_desc";
    if (normalized.includes("bán chạy")) return "created_desc";

    return "created_desc";
}

function setProductCount(count) {
    const title = document.querySelector(".content-header h2");
    if (!title) return;

    const span = title.querySelector("span");
    if (span) {
        span.textContent = `(${count} sản phẩm)`;
    }
}

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
        const title = escapeHtml(product.title || "");
        const brand = escapeHtml(product.brand || "");
        const thumbnail = escapeHtml(product.thumbnail || "https://via.placeholder.com/300x300?text=No+Image");
        const currentPrice = formatPrice(product.current_price);
        const oldPrice = parsePrice(product.old_price) > 0 ? formatPrice(product.old_price) : "";
        const discount = escapeHtml(product.discount || "");
        const rating = escapeHtml(product.rating || "4.9");
        const soldText = escapeHtml(product.sold_text || "1k/tháng");

        return `
            <div class="product-card">
                ${discount ? `<span class="discount-badge">${discount}</span>` : ""}
                <img
                    class="product-img"
                    src="${thumbnail}"
                    alt="${title}"
                    onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'"
                >
                <div class="product-info">
                    <div class="brand">${brand}</div>
                    <div class="product-title" title="${title}">${title}</div>
                    <div class="price-group">
                        <span class="current-price">${currentPrice}</span>
                        ${oldPrice ? `<span class="old-price">${oldPrice}</span>` : ""}
                    </div>
                    <div class="product-rating">
                        <span class="stars">★ ${rating}</span>
                        <span>${soldText}</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

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

    if (state.sort === "price_asc") {
        products.sort((a, b) => parsePrice(a.current_price) - parsePrice(b.current_price));
    } else if (state.sort === "price_desc") {
        products.sort((a, b) => parsePrice(b.current_price) - parsePrice(a.current_price));
    } else {
        products.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
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

    try {
        productList.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; padding: 50px;">
                Đang tải sản phẩm từ hệ thống...
            </p>
        `;

        const response = await fetch(`${API_BASE_URL}/products`);

        if (!response.ok) {
            throw new Error(`API lỗi: ${response.status}`);
        }

        const products = await response.json();
        state.allProducts = Array.isArray(products) ? products : [];

        renderBrandFilters(state.allProducts);
        applyClientFilters();
    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        productList.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; padding: 50px; color:red;">
                Không tải được sản phẩm từ hệ thống.
            </p>
        `;
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

document.addEventListener("DOMContentLoaded", () => {
    bindSortTabs();
    bindSearch();
    bindPriceFilter();
    loadProducts();
});