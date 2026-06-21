var API_BASE_URL = "/api";
var isEditing = false;
var allProductsData = [];
var allOrdersData = [];

// =========================================================
// TÍNH NĂNG SẮP XẾP SẢN PHẨM BẰNG KÉO THẢ
// - Lưu vào API nếu backend hỗ trợ display_order
// - Đồng thời lưu localStorage để refresh không bị quay về thứ tự cũ
// =========================================================
const MORACHI_PRODUCT_ORDER_KEY = "morachi_product_order_ids";

window.clearShopProductCache = function() {
    try {
        sessionStorage.removeItem("morachi_products_cache");
        sessionStorage.removeItem("morachi_products_cache_time");
    } catch (e) {}
};

window.getSavedProductOrderIds = function() {
    try {
        const raw = localStorage.getItem(MORACHI_PRODUCT_ORDER_KEY);
        const ids = JSON.parse(raw || "[]");
        return Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    } catch (e) {
        return [];
    }
};

window.saveProductOrderIdsLocal = function(ids) {
    try {
        const cleanIds = [...new Set((ids || []).map(String).filter(Boolean))];
        localStorage.setItem(MORACHI_PRODUCT_ORDER_KEY, JSON.stringify(cleanIds));
    } catch (e) {
        console.warn("Không lưu được thứ tự sản phẩm vào localStorage:", e);
    }
};

window.applySavedProductOrder = function(products) {
    const list = Array.isArray(products) ? products.map(p => ({ ...p })) : [];
    const savedIds = window.getSavedProductOrderIds();

    if (!savedIds.length) {
        return list.map((p, index) => ({
            ...p,
            display_order: Number(p.display_order || p.sort_order || p.position || index + 1)
        }));
    }

    const orderMap = new Map(savedIds.map((id, index) => [String(id), index + 1]));
    const maxSavedOrder = savedIds.length;

    return list.map((p, index) => {
        const savedOrder = orderMap.get(String(p.id));
        const apiOrder = Number(p.display_order || p.sort_order || p.position);
        const fallbackOrder = Number.isFinite(apiOrder) && apiOrder > 0 ? apiOrder : maxSavedOrder + index + 1;

        return {
            ...p,
            display_order: savedOrder || fallbackOrder
        };
    });
};

window.getProductDisplayOrder = function(product, fallbackIndex = 999999) {
    const raw = product.display_order ?? product.sort_order ?? product.position;
    const number = Number(raw);
    return Number.isFinite(number) && number > 0 ? number : fallbackIndex;
};

window.sortProductsForAdmin = function(products) {
    return [...(products || [])].sort((a, b) => {
        const orderA = window.getProductDisplayOrder(a, 999999);
        const orderB = window.getProductDisplayOrder(b, 999999);

        if (orderA !== orderB) return orderA - orderB;

        const dateA = new Date(a.created_at || a.updated_at || 0).getTime() || 0;
        const dateB = new Date(b.created_at || b.updated_at || 0).getTime() || 0;
        return dateB - dateA;
    });
};


window.verifyProductOrderSavedToServer = async function(expectedIds) {
    try {
        const res = await fetch(`${API_BASE_URL}/products?t=${Date.now()}&verify_order=1`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });
        if (!res.ok) return false;
        const products = await res.json();
        if (!Array.isArray(products)) return false;

        const byId = new Map(products.map(p => [String(p.id), p]));
        return expectedIds.every((id, index) => {
            const product = byId.get(String(id));
            if (!product) return false;
            const order = Number(product.display_order ?? product.sort_order ?? product.position);
            return Number.isFinite(order) && order === index + 1;
        });
    } catch (e) {
        console.warn("Không kiểm tra được display_order từ server:", e);
        return false;
    }
};

// Alias để giữ tương thích với code đang gọi tên cũ
function getDisplayOrder(product, index = 0) {
    return window.getProductDisplayOrder(product, index + 1);
}

function sortProductsByDisplayOrder(products) {
    return window.sortProductsForAdmin(window.applySavedProductOrder(products));
}

window.getNextProductDisplayOrder = function() {
    if (!allProductsData || allProductsData.length === 0) return 1;

    const maxOrder = allProductsData.reduce((max, item, index) => {
        const order = window.getProductDisplayOrder(item, index + 1);
        return Math.max(max, order);
    }, 0);

    return maxOrder + 1;
};

window.showReorderStatus = function(message, type = "info") {
    let el = document.getElementById("reorder-status");

    if (!el) {
        el = document.createElement("div");
        el.id = "reorder-status";
        el.className = "reorder-status";
        document.body.appendChild(el);
    }

    el.className = "reorder-status show " + type;
    el.innerHTML = message;

    clearTimeout(window.__reorderStatusTimer);
    window.__reorderStatusTimer = setTimeout(() => {
        el.classList.remove("show");
    }, 3000);
};

window.buildProductPayloadForOrderSave = function(product) {
    return {
        title: product.title || "",
        brand: product.brand || "",
        current_price: product.current_price || "",
        old_price: product.old_price || "",
        discount: product.discount || "",
        description: product.description || "",
        specifications: product.specifications || "",
        ingredients: product.ingredients || "",
        usage_manual: product.usage_manual || "",
        thumbnail: product.thumbnail || "",
        status: product.status || "active",
        variants: Array.isArray(product.variants) ? product.variants : [],
        display_order: Number(product.display_order) || 999999
    };
};

window.persistProductOrder = async function() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;

    const visibleIds = [...tbody.querySelectorAll("tr[data-product-id]")]
        .map(row => String(row.dataset.productId))
        .filter(Boolean);

    if (visibleIds.length <= 1) return;

    const productById = new Map(allProductsData.map(p => [String(p.id), p]));
    const visibleSet = new Set(visibleIds);

    // Giữ nguyên vị trí các sản phẩm đang bị lọc ẩn, chỉ đổi thứ tự các dòng đang hiển thị.
    const currentGlobalOrder = window.sortProductsForAdmin(allProductsData);
    const visibleQueue = [...visibleIds];

    const newGlobalOrder = currentGlobalOrder.map(product => {
        const id = String(product.id);
        if (!visibleSet.has(id)) return product;

        const nextVisibleId = visibleQueue.shift();
        return productById.get(String(nextVisibleId)) || product;
    });

    // Đánh lại thứ tự từ 1 -> n
    newGlobalOrder.forEach((product, index) => {
        product.display_order = index + 1;
    });

    allProductsData = newGlobalOrder;

    // LƯU LOCAL TRƯỚC: giúp refresh không bị quay về thứ tự cũ dù backend chưa hỗ trợ display_order
    const allIdsInNewOrder = newGlobalOrder.map(p => String(p.id));
    window.saveProductOrderIdsLocal(allIdsInNewOrder);
    window.clearShopProductCache();

    window.showReorderStatus('<i class="fas fa-spinner fa-spin"></i> Đang lưu thứ tự sản phẩm...', 'info');

    const orders = newGlobalOrder.map(product => ({
        id: product.id,
        display_order: Number(product.display_order) || 999999
    }));

    let savedToServer = false;

    try {
        // Ưu tiên endpoint riêng nếu backend có hỗ trợ.
        try {
            const bulkRes = await fetch(`${API_BASE_URL}/products/reorder`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orders, items: orders })
            });

            if (bulkRes.ok) {
                savedToServer = true;
            }
        } catch (e) {
            savedToServer = false;
        }

        // Nếu backend chưa có /products/reorder thì dùng API cập nhật sản phẩm hiện có.
        if (!savedToServer) {
            const results = [];
            for (const product of newGlobalOrder) {
                const res = await fetch(`${API_BASE_URL}/products/${product.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(window.buildProductPayloadForOrderSave(product))
                });
                results.push(res);
            }

            savedToServer = results.every(res => res.ok);
        }

        if (savedToServer) {
            const verified = await window.verifyProductOrderSavedToServer(allIdsInNewOrder);
            if (verified) {
                window.showReorderStatus('<i class="fas fa-check-circle"></i> Đã lưu thứ tự lên server. Điện thoại sẽ hiển thị đúng sau khi tải lại!', 'success');
            } else {
                window.showReorderStatus('<i class="fas fa-exclamation-triangle"></i> Admin đã đổi thứ tự, nhưng API chưa trả về display_order. Cần cập nhật backend để điện thoại thấy đúng.', 'warning');
            }
        } else {
            window.showReorderStatus('<i class="fas fa-info-circle"></i> Đã lưu thứ tự trên trình duyệt này. Backend chưa lưu display_order nên điện thoại chưa đồng bộ.', 'warning');
        }

        window.renderTable(window.sortProductsForAdmin(allProductsData));
    } catch (err) {
        console.error(err);
        // Không reload lại vì sẽ làm người dùng tưởng bị mất thứ tự. LocalStorage vẫn giữ thứ tự đã kéo.
        window.showReorderStatus('<i class="fas fa-info-circle"></i> Đã giữ thứ tự trên trình duyệt. API chưa lưu được.', 'warning');
        window.renderTable(window.sortProductsForAdmin(allProductsData));
    }
};

window.getDragAfterElement = function(container, y) {
    const draggableElements = [...container.querySelectorAll("tr.drag-sort-row:not(.dragging)")];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        }

        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

window.enableProductDragSort = function() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;

    let draggedRow = null;
    const rows = [...tbody.querySelectorAll("tr[data-product-id]")];

    rows.forEach(row => {
        const handle = row.querySelector(".drag-handle");
        if (!handle) return;

        row.draggable = false;

        handle.addEventListener("mousedown", () => {
            row.draggable = true;
        });

        handle.addEventListener("mouseup", () => {
            row.draggable = false;
        });

        handle.addEventListener("touchstart", () => {
            row.draggable = true;
        }, { passive: true });

        row.addEventListener("dragstart", (event) => {
            draggedRow = row;
            row.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", row.dataset.productId || "");
        });

        row.addEventListener("dragend", () => {
            row.classList.remove("dragging");
            row.draggable = false;
            draggedRow = null;
            window.persistProductOrder();
        });
    });

    tbody.addEventListener("dragover", (event) => {
        if (!draggedRow) return;

        event.preventDefault();
        const afterElement = window.getDragAfterElement(tbody, event.clientY);

        if (afterElement == null) {
            tbody.appendChild(draggedRow);
        } else {
            tbody.insertBefore(draggedRow, afterElement);
        }
    });
};


// =========================================================
// PHẦN 1: QUẢN LÝ KHO SẢN PHẨM
// =========================================================

window.loadAdminProducts = async function() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 40px;'><i class='fas fa-spinner fa-spin'></i> Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products?t=${new Date().getTime()}`);
        const products = await response.json();
        
        allProductsData = Array.isArray(products)
            ? sortProductsByDisplayOrder(products)
            : [];

        window.updateDashboardStats(allProductsData);
        window.populateBrandFilter(allProductsData);
        window.renderTable(allProductsData);
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
    }
}

window.updateDashboardStats = function(products) {
    if(!document.getElementById("stat-total")) return;

    let total = products.length;
    let active = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let brands = new Set();

    products.forEach(p => {
        if(p.brand) brands.add(p.brand.trim());
        
        let totalStock = 0;
        if (p.variants && p.variants.length > 0) {
            totalStock = p.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        }

        if (totalStock > 0) active++;
        if (totalStock > 0 && totalStock <= 10) lowStock++;
        if (totalStock === 0) outOfStock++;
    });

    document.getElementById("stat-total").innerText = total.toLocaleString();
    document.getElementById("stat-active").innerText = active.toLocaleString();
    document.getElementById("stat-low").innerText = lowStock.toLocaleString();
    document.getElementById("stat-out").innerText = outOfStock.toLocaleString();
    document.getElementById("stat-brands").innerText = brands.size.toLocaleString();
}

window.populateBrandFilter = function(products) {
    const brandSelect = document.getElementById("filter-brand");
    if(!brandSelect) return;
    
    let brands = [...new Set(products.map(p => p.brand).filter(b => b))];
    let html = `<option value="">Thương hiệu</option>`;
    brands.forEach(b => { html += `<option value="${b}">${b}</option>`; });
    brandSelect.innerHTML = html;

    brandSelect.addEventListener('change', function() {
        const val = this.value;
        const kw = document.getElementById("admin-search-input").value.toLowerCase().trim();
        window.filterProducts(kw, val);
    });
}

window.filterProducts = function(keyword, brandFilter) {
    const filtered = allProductsData.filter(p => {
        const titleMatch = (p.title || "").toLowerCase().includes(keyword);
        const brandMatch = brandFilter ? p.brand === brandFilter : true;
        return titleMatch && brandMatch;
    });
    window.renderTable(sortProductsByDisplayOrder(filtered));
}

window.bindAdminSearch = function() {
    const searchInput = document.getElementById("admin-search-input");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        const brandFilter = document.getElementById("filter-brand") ? document.getElementById("filter-brand").value : "";
        window.filterProducts(keyword, brandFilter);
    });
}

window.renderTable = function(products) {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;

    const sortedProducts = window.sortProductsForAdmin(products || []);

    if (sortedProducts.length === 0) {
        tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; padding: 40px; color:#888;'>Không tìm thấy sản phẩm phù hợp.</td></tr>";
        return;
    }

    tbody.innerHTML = sortedProducts.map((p, index) => {
        const variants = p.variants || [];
        let totalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);

        let variantHtml = '';
        if (variants.length > 0) {
            let limitVariants = variants.slice(0, 3);
            variantHtml = limitVariants.map(v => `<span class="variant-pill">${v.name}</span>`).join('');
            if (variants.length > 3) {
                variantHtml += `<span class="variant-pill" style="background:#fff2eb; color:#f57224; border:none;">+${variants.length - 3}</span>`;
            }
        }

        const badgeHtml = p.discount ? `<span class="badge-hot">${p.discount}</span>` : '';

        let stockDot = '';
        let stockText = '';
        let statusBadge = '';

        if (totalStock > 10) {
            stockDot = '<div class="dot green"></div>';
            stockText = `<div style="color:var(--success);">${totalStock} <br><span style="font-size:11px; font-weight:normal; color:#888;">Còn hàng</span></div>`;
            statusBadge = `<span class="status-badge active">Đang bán</span>`;
        } else if (totalStock > 0 && totalStock <= 10) {
            stockDot = '<div class="dot yellow"></div>';
            stockText = `<div style="color:var(--warning);">${totalStock} <br><span style="font-size:11px; font-weight:normal; color:#888;">Sắp hết</span></div>`;
            statusBadge = `<span class="status-badge active">Đang bán</span>`;
        } else {
            stockDot = '<div class="dot red"></div>';
            stockText = `<div style="color:var(--danger);">0 <br><span style="font-size:11px; font-weight:normal; color:#888;">Hết hàng</span></div>`;
            statusBadge = `<span class="status-badge out">Hết hàng</span>`;
        }

        return `
            <tr class="drag-sort-row" data-product-id="${p.id}">
                <td class="sort-cell">
                    <button type="button" class="drag-handle" title="Giữ chuột và kéo để đổi thứ tự">
                        <i class="fas fa-grip-vertical"></i>
                    </button>
                    <span class="sort-number">${window.getProductDisplayOrder(p, index + 1)}</span>
                </td>
                <td style="text-align: center;"><input type="checkbox"></td>
                <td>
                    <div class="product-cell">
                        <img src="${p.thumbnail}" onerror="this.src='/images/icon-logo.png'">
                        <div class="info">
                            <div class="name">${p.title} ${badgeHtml}</div>
                            <div class="variants-list">${variantHtml}</div>
                        </div>
                    </div>
                </td>
                <td style="color:#555; font-weight:500;">${p.brand || 'N/A'}</td>
                <td>
                    <div class="stock-status">
                        ${stockDot} ${stockText}
                    </div>
                </td>
                <td style="color: var(--accent); font-weight: 600;">${Number(p.current_price).toLocaleString('vi-VN')} đ</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="actions">
                        <button class="btn-icon" title="Chỉnh sửa" onclick="window.editProduct('${p.id}')"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon" title="Xóa" style="color:var(--danger);" onclick="window.deleteProduct('${p.id}', '${p.brand}')"><i class="far fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    window.enableProductDragSort();
}

window.deleteProduct = async function(id, brand) {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${brand}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: "DELETE" });
        if (res.ok) { 
            window.clearShopProductCache();
            window.loadAdminProducts(); 
        }
    } catch (err) { alert("Lỗi hệ thống khi xóa!"); }
}

window.addVariantRow = function(data = {}) {
    const container = document.getElementById("variants-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "variant-row";
    
    row.innerHTML = `
        <div>
            <label>Phân loại <span style="color:red">*</span></label>
            <input type="text" class="v-name" autocomplete="off" value="${data.name || ''}" placeholder="VD: Đỏ, 50ml" required>
        </div>
        <div>
            <label>Số lượng</label>
            <input type="number" class="v-stock" autocomplete="off" value="${data.stock !== undefined ? data.stock : 0}">
        </div>
        <div>
            <label>Trạng thái</label>
            <select class="v-status">
                <option value="instock" ${data.status === 'instock' ? 'selected' : ''}>Sẵn hàng</option>
                <option value="order" ${data.status === 'order' ? 'selected' : ''}>Hàng Order</option>
                <option value="out" ${data.status === 'out' ? 'selected' : ''}>Hết hàng</option>
            </select>
        </div>
        <div>
            <label>Dự kiến</label>
            <input type="text" class="v-date" autocomplete="off" value="${data.date || ''}" placeholder="VD: 25/05">
        </div>
        <div>
            <label>Giá riêng</label>
            <input type="number" class="v-price" autocomplete="off" value="${data.price || ''}" placeholder="Giá VNĐ">
        </div>
        <div>
            <label>Ảnh riêng</label>
            <input type="file" class="v-file" accept="image/*" style="font-size: 11px; padding: 4px; border:none;">
            <input type="hidden" class="v-image-url" value="${data.image || ''}">
        </div>
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size: 16px; padding-bottom: 5px;" title="Xóa dòng này">
            <i class="fas fa-times"></i>
        </button>
        ${data.image ? `<div style="grid-column: 1/-1; margin-top: 5px; font-size: 11px;"><a href="${data.image}" target="_blank" style="color:#3498db; text-decoration:none;"><i class="fas fa-image"></i> Xem ảnh đã lưu</a></div>` : ''}
    `;
    container.appendChild(row);
}

window.editProduct = async function(id) {
    try {
        // KHẮC PHỤC: Đảm bảo so sánh chính xác ID tuyệt đối
        const p = allProductsData.find(item => String(item.id) === String(id));
        
        if (p) {
            document.getElementById("product-id").value = p.id;
            document.getElementById("product-thumbnail-old").value = p.thumbnail || ""; 
            document.getElementById("title").value = p.title || "";
            document.getElementById("brand").value = p.brand || "";
            document.getElementById("current_price").value = p.current_price || "";
            
            if (document.getElementById("old_price")) document.getElementById("old_price").value = p.old_price || "";
            if (document.getElementById("discount")) document.getElementById("discount").value = p.discount || "";
            
            if (document.getElementById("description")) document.getElementById("description").value = p.description || "";
            if (document.getElementById("specifications")) document.getElementById("specifications").value = p.specifications || "";
            if (document.getElementById("ingredients")) document.getElementById("ingredients").value = p.ingredients || "";
            if (document.getElementById("usage_manual")) document.getElementById("usage_manual").value = p.usage_manual || "";
            
            const container = document.getElementById("variants-container");
            if (container) {
                container.innerHTML = "";
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => window.addVariantRow(v));
                } else {
                    window.addVariantRow();
                }
            }
            window.openModal(true);
        }
    } catch (err) { alert("Lỗi khi tải thông tin sản phẩm!"); }
}

window.openModal = function(isEdit = false) {
    isEditing = isEdit;
    const msg = document.getElementById("message");
    if(msg) msg.innerText = "";
    
    const titleEl = document.getElementById("modalTitle");
    if(titleEl) titleEl.innerText = isEdit ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới";
    
    const modal = document.getElementById("productModal");
    if(modal) modal.style.display = "flex";

    // KHẮC PHỤC LỖI NHẢY ẢNH: Luôn làm sạch ô chọn file ảnh mỗi khi mở form (chống dính ảnh từ sản phẩm trước)
    const thumbnailInput = document.getElementById("thumbnail_file");
    if(thumbnailInput) thumbnailInput.value = "";
    
    if (!isEdit) {
        const formEl = document.getElementById("product-form");
        if(formEl) formEl.reset();
        document.getElementById("product-id").value = "";
        document.getElementById("product-thumbnail-old").value = ""; // Clear ảnh cũ
        
        const container = document.getElementById("variants-container");
        if (container) {
            container.innerHTML = "";
            window.addVariantRow(); 
        }
    }
}

window.closeModal = function() {
    const modal = document.getElementById("productModal");
    if(modal) modal.style.display = "none";
}

var form = document.getElementById("product-form");
if (form) {
    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        const msg = document.getElementById("message") || document.createElement('div');
        msg.innerText = "Đang lưu và đồng bộ dữ liệu...";
        msg.style.color = "#4f46e5";

        try {
            const id = document.getElementById("product-id").value;
            const file = document.getElementById("thumbnail_file").files[0];
            let imageUrl = "";

            if (file) {
                const formData = new FormData();
                formData.append("file", file);
                const resImg = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: formData });
                if (!resImg.ok) throw new Error("Lỗi upload ảnh chính");
                const dataImg = await resImg.json();
                imageUrl = dataImg.url;
            }

            const variantsArray = [];
            const variantRows = document.querySelectorAll(".variant-row");
            
            for (let row of variantRows) {
                const vNameInput = row.querySelector(".v-name");
                if (!vNameInput || vNameInput.value.trim() === "") continue;

                const vStockInput = row.querySelector(".v-stock");
                const vStatusInput = row.querySelector(".v-status");
                const vDateInput = row.querySelector(".v-date");
                const vPriceInput = row.querySelector(".v-price");
                
                let vImageUrl = row.querySelector(".v-image-url") ? row.querySelector(".v-image-url").value : "";
                const vFile = row.querySelector(".v-file");

                if (vFile && vFile.files && vFile.files[0]) {
                    msg.innerText = `Đang tải ảnh phân loại: ${vNameInput.value}...`;
                    const vFormData = new FormData();
                    vFormData.append("file", vFile.files[0]);
                    try {
                        const vResImg = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: vFormData });
                        if (vResImg.ok) {
                            const vDataImg = await vResImg.json();
                            vImageUrl = vDataImg.url;
                        }
                    } catch (e) {
                        console.error("Lỗi upload ảnh biến thể:", e);
                    }
                }

                variantsArray.push({
                    name: vNameInput.value.trim(),
                    stock: vStockInput ? (parseInt(vStockInput.value) || 0) : 0,
                    status: vStatusInput ? vStatusInput.value : "instock",
                    date: vDateInput ? vDateInput.value.trim() : "",
                    price: vPriceInput && vPriceInput.value ? parseInt(vPriceInput.value) : null,
                    image: vImageUrl
                });
            }
            
            const productData = {
                title: document.getElementById("title").value.trim(),
                brand: document.getElementById("brand").value.trim(),
                current_price: document.getElementById("current_price").value.trim(),
                old_price: document.getElementById("old_price") ? document.getElementById("old_price").value.trim() : "",
                discount: document.getElementById("discount") ? document.getElementById("discount").value.trim() : "",
                
                description: document.getElementById("description") ? document.getElementById("description").value.trim() : "",
                specifications: document.getElementById("specifications") ? document.getElementById("specifications").value.trim() : "",
                ingredients: document.getElementById("ingredients") ? document.getElementById("ingredients").value.trim() : "",
                usage_manual: document.getElementById("usage_manual") ? document.getElementById("usage_manual").value.trim() : "",
                
                status: "active",
                variants: variantsArray,
                display_order: (() => {
                    const existingProduct = allProductsData.find(item => String(item.id) === String(id));
                    return existingProduct ? window.getProductDisplayOrder(existingProduct, 999999) : window.getNextProductDisplayOrder();
                })()
            };

            if (imageUrl) {
                productData.thumbnail = imageUrl; 
            } else {
                productData.thumbnail = document.getElementById("product-thumbnail-old").value; 
            }

            const url = isEditing ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`;
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productData)
            });

            if (res.ok) {
                msg.innerText = isEditing ? "Cập nhật thành công!" : "Thêm mới thành công!";
                msg.style.color = "var(--success)";
                
                window.clearShopProductCache();
                
                setTimeout(() => { window.closeModal(); window.loadAdminProducts(); }, 1200);
            } else {
                throw new Error("API backend từ chối lưu dữ liệu");
            }
        } catch (err) {
            msg.innerText = err.message || "Có lỗi xảy ra!";
            msg.style.color = "var(--danger)";
            console.error(err);
        }
    });
}


// =========================================================
// HỖ TRỢ HIỂN THỊ ĐỊA CHỈ ĐƠN HÀNG
// Chỉ đọc dữ liệu sẵn có từ đơn hàng, không thay đổi logic đơn hàng.
// Hỗ trợ nhiều tên field để tránh đơn cũ/đơn mới bị thiếu địa chỉ.
// =========================================================
window.escapeAdminHtml = window.escapeAdminHtml || function(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.cleanOrderText = window.cleanOrderText || function(value) {
    const text = String(value ?? "").trim();
    if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") return "";
    return text;
};

window.firstOrderValue = window.firstOrderValue || function(...values) {
    for (const value of values) {
        const text = window.cleanOrderText(value);
        if (text) return text;
    }
    return "";
};

window.buildOrderAddress = window.buildOrderAddress || function(order) {
    const o = order || {};
    const c = o.customer_info || {};

    const detail = window.firstOrderValue(
        c.address,
        c.address_detail,
        c.detail_address,
        c.street,
        o.customer_address,
        o.address,
        o.address_detail,
        o.detail_address,
        o.street
    );

    const ward = window.firstOrderValue(
        c.ward,
        c.ward_name,
        c.customer_ward,
        o.ward,
        o.ward_name,
        o.customer_ward
    );

    const district = window.firstOrderValue(
        c.district,
        c.dist,
        c.district_name,
        c.customer_district,
        o.district,
        o.dist,
        o.district_name,
        o.customer_district
    );

    const province = window.firstOrderValue(
        c.province,
        c.prov,
        c.city,
        c.province_name,
        c.customer_province,
        o.province,
        o.prov,
        o.city,
        o.province_name,
        o.customer_province
    );

    const fullAddress = window.firstOrderValue(
        c.full_address,
        c.shipping_address,
        c.customer_address,
        o.full_address,
        o.shipping_address
    );

    const parts = [];
    const addPart = (value) => {
        const text = window.cleanOrderText(value);
        if (!text) return;
        const normalized = text.toLowerCase().replace(/\s+/g, " ");
        const exists = parts.some(part => {
            const current = part.toLowerCase().replace(/\s+/g, " ");
            return current.includes(normalized) || normalized.includes(current);
        });
        if (!exists) parts.push(text);
    };

    addPart(fullAddress || detail);
    addPart(ward);
    addPart(district);
    addPart(province);

    return parts.join(", ");
};

// =========================================================
// PHẦN 2: QUẢN LÝ ĐƠN HÀNG
// =========================================================

window.switchTab = function(tabId) {
    const secProducts = document.getElementById('section-products');
    const secOrders = document.getElementById('section-orders');
    const menuProducts = document.getElementById('menu-products');
    const menuOrders = document.getElementById('menu-orders');

    if (secProducts) secProducts.classList.remove('active');
    if (secOrders) secOrders.classList.remove('active');
    if (menuProducts) menuProducts.classList.remove('active');
    if (menuOrders) menuOrders.classList.remove('active');

    const activeSec = document.getElementById(`section-${tabId}`);
    const activeMenu = document.getElementById(`menu-${tabId}`);
    if (activeSec) activeSec.classList.add('active');
    if (activeMenu) activeMenu.classList.add('active');

    if (tabId === 'orders') {
        window.loadOrders();
    }
}

window.updateOrderDashboardStats = function(orders) {
    let todayCount = 0;
    let prepCount = 0;
    let transitCount = 0;
    let deliveringCount = 0;

    let todayString = new Date().toDateString();

    orders.forEach(o => {
        let orderDate = o.created_at || o.date;
        if (orderDate) {
            let d = new Date(orderDate);
            if (!isNaN(d.getTime()) && d.toDateString() === todayString) {
                todayCount++;
            }
        }

        let status = o.status || "";
        if (status === "Đang chuẩn bị hàng") prepCount++;
        if (status === "Đang chờ hàng về Việt Nam") transitCount++;
        if (status === "Đang giao hàng") deliveringCount++;
    });

    const statToday = document.getElementById('stat-order-today');
    if(statToday) statToday.innerHTML = todayCount.toLocaleString('vi-VN');

    const statPrep = document.getElementById('stat-order-prep');
    if(statPrep) statPrep.innerHTML = prepCount.toLocaleString('vi-VN');

    const statTransit = document.getElementById('stat-order-transit');
    if(statTransit) statTransit.innerHTML = transitCount.toLocaleString('vi-VN');

    const statDelivering = document.getElementById('stat-order-delivering');
    if(statDelivering) statDelivering.innerHTML = deliveringCount.toLocaleString('vi-VN');
}

window.loadOrders = async function() {
    const tbody = document.getElementById('admin-order-list');
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px;'><i class='fas fa-spinner fa-spin'></i> Đang tải đơn hàng...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/orders?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error("API lỗi");
        const orders = await response.json();
        
        allOrdersData = Array.isArray(orders) ? orders : [];
        localStorage.setItem('morachi_orders', JSON.stringify(allOrdersData));

        const checkAllEl = document.getElementById('check-all-orders');
        if (checkAllEl) checkAllEl.checked = false;
        window.updateBulkActionBar(); 

        window.updateOrderDashboardStats(allOrdersData);
        window.renderOrdersTable(allOrdersData);
        
    } catch (err) {
        console.error("Lỗi lấy đơn hàng:", err);
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối máy chủ!</td></tr>";
    }
}

window.renderOrdersTable = function(ordersList) {
    const tbody = document.getElementById('admin-order-list');
    if (!tbody) return;

    if (!ordersList || ordersList.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px; color:#888;'>Không tìm thấy đơn hàng phù hợp với trạng thái này.</td></tr>";
        return;
    }

    tbody.innerHTML = ordersList.map(o => {
        const c = o.customer_info || {};
        const items = o.items || [];
        
        let timeDisplay = "";
        let orderDate = o.created_at || o.date; 
        
        if (orderDate) {
            let d = new Date(orderDate);
            if (!isNaN(d.getTime())) { 
                let hours = String(d.getHours()).padStart(2, '0');
                let minutes = String(d.getMinutes()).padStart(2, '0');
                
                let today = new Date();
                let yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                let dateStr = "";
                if (d.toDateString() === today.toDateString()) {
                    dateStr = "Hôm nay";
                } else if (d.toDateString() === yesterday.toDateString()) {
                    dateStr = "Hôm qua";
                } else {
                    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                }
                timeDisplay = `${hours}:${minutes} • ${dateStr}`;
            } else {
                timeDisplay = "Không có CSDL";
            }
        } else {
            timeDisplay = "Chưa cập nhật";
        }
        
        let itemDisplay = '';
        if (items.length > 0) {
            itemDisplay = `<div style="font-size:13px; font-weight: 500; color: var(--text-main); margin-bottom:3px;">${items[0].title} (${items[0].variant || 'Mặc định'}) x<b>${items[0].quantity}</b></div>`;
            
            if (items.length > 1) {
                let otherItemsHtml = items.slice(1).map(i => `
                    <div style="padding: 6px 0; border-bottom: 1px dashed #eaeef2;">
                        <div style="font-weight: 500;">• ${i.title}</div>
                        <div style="color: #7a828a; font-size: 11px; margin-top: 2px; padding-left: 10px;">
                            Phân loại: ${i.variant || 'Mặc định'} - Số lượng: <b style="color:var(--text-main);">${i.quantity}</b>
                        </div>
                    </div>
                `).join('');
                
                itemDisplay += `
                <details style="font-size:12px; margin-top: 5px; outline:none; cursor:pointer;">
                    <summary style="outline:none; color: #3498db; font-weight: 600; list-style-position: inside; transition: 0.2s;">
                        + ${items.length - 1} sản phẩm khác (Bấm để xem)
                    </summary>
                    <div style="background: #f8f9fa; padding: 5px 12px; border-radius: 8px; margin-top: 6px; border: 1px solid #eaeef2; color: var(--text-main);">
                        ${otherItemsHtml}
                    </div>
                </details>`;
            }
        }

        let badgeClass = 'yellow';
        let statusText = o.status || 'Chờ xác nhận';
        
        if (statusText === 'Đang chuẩn bị hàng' || statusText.includes('Chờ xác nhận đã chuyển khoản')) {
            badgeClass = 'yellow'; 
        } else if (statusText.includes('Xác nhận đặt đơn Shipcod thành công') || statusText === 'Đang chờ hàng về Việt Nam') {
            badgeClass = 'purple';
        } else if (statusText === 'Đang giao hàng') {
            badgeClass = 'blue';
        } else if (statusText === 'Đã giao hàng') {
            badgeClass = 'green';
        } else if (statusText === 'Đã hủy') {
            badgeClass = 'red';
        }

        let statusBadge = `<span class="badge-status ${badgeClass}">${statusText}</span>`;

        let spxHtml = o.spx_tracking_code 
            ? `<div style="margin-top:4px; color:var(--success); font-size:11px; font-weight:500;"><i class="fas fa-truck"></i> SPX: <b>${o.spx_tracking_code}</b></div>` 
            : ``;

        const addressText = window.buildOrderAddress(o);
        const addressHtml = addressText
            ? `<div style="font-size:12px; color:#555; margin-top:5px; line-height:1.45; max-width: 280px;"><i class="fas fa-map-marker-alt" style="color:#aaa; font-size:10px; margin-right:4px;"></i>${window.escapeAdminHtml(addressText)}</div>`
            : `<div style="font-size:12px; color:#bbb; margin-top:5px; line-height:1.45;"><i class="fas fa-map-marker-alt" style="font-size:10px; margin-right:4px;"></i>Chưa có địa chỉ</div>`;

        return `
            <tr>
                <td style="text-align: center;">
                    <input type="checkbox" class="order-checkbox" value="${o.id}" data-orderid="${o.order_id || 'N/A'}" data-total="${o.total_amount || 0}" onclick="window.updateBulkActionBar()">
                </td>
                <td>
                    <div style="font-weight:700; color:var(--text-main); font-size:13px;">${o.order_id || 'N/A'}</div>
                    <div style="font-size:11px; color:var(--text-light); margin-top:3px;">${timeDisplay}</div>
                </td>
                <td>
                    <div style="font-weight:600; color:var(--text-main); font-size:13px;">${window.escapeAdminHtml(c.name || 'N/A')}</div>
                    <div style="font-size:12px; color:var(--text-light); margin-top:3px;"><i class="fas fa-phone-alt" style="color:#aaa; font-size:10px;"></i> ${window.escapeAdminHtml(c.phone || '')}</div>
                    ${addressHtml}
                </td>
                <td>
                    ${itemDisplay}
                    ${spxHtml}
                </td>
                <td style="font-weight:700; color:#e74c3c; font-size:14px;">${Number(o.total_amount || 0).toLocaleString('vi-VN')}đ</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-btns">
                        <button title="Cập nhật Trạng thái" onclick="window.updateOrderStatus('${o.id}', '${o.status || ''}', '${o.spx_tracking_code || ''}')"><i class="fas fa-check"></i></button>
                        <button title="In hóa đơn/Vận đơn"><i class="fas fa-print"></i></button>
                        <button title="Thao tác khác"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

window.filterOrdersByStatus = function(status) {
    const checkAllEl = document.getElementById('check-all-orders');
    if (checkAllEl) checkAllEl.checked = false;
    window.updateBulkActionBar();
    
    if (!status) {
        window.renderOrdersTable(allOrdersData);
        return;
    }
    
    const filteredOrders = allOrdersData.filter(o => {
        const currentStatus = o.status || 'Chờ xác nhận';
        return currentStatus.toLowerCase() === status.toLowerCase();
    });
    
    window.renderOrdersTable(filteredOrders);
}

window.updateBulkActionBar = function() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    const bulkBar = document.getElementById('bulk-action-bar');
    if (!bulkBar) return;

    if (checkboxes.length > 0) {
        bulkBar.classList.add('show');
        let totalMoney = 0;
        checkboxes.forEach(cb => {
            totalMoney += parseInt(cb.getAttribute('data-total') || 0);
        });
        
        document.getElementById('selected-count').innerText = checkboxes.length;
        document.getElementById('selected-total').innerText = totalMoney.toLocaleString('vi-VN') + 'đ';
        
        document.querySelectorAll('.sel-count').forEach(el => {
            el.innerText = checkboxes.length;
        });
    } else {
        bulkBar.classList.remove('show');
    }
}

window.toggleAllOrders = function(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    window.updateBulkActionBar();
}

window.applyBulkStatus = async function() {
    const selectedStatus = document.getElementById('bulk-status-select').value;
    
    if (!selectedStatus) {
        alert("Vui lòng chọn trạng thái muốn cập nhật từ danh sách!");
        return;
    }

    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Vui lòng tích chọn ít nhất 1 đơn hàng trong bảng!");
        return;
    }

    const selectedOrders = Array.from(checkboxes).map(cb => ({
        id: cb.value,
        orderId: cb.getAttribute('data-orderid')
    }));

    if (!confirm(`Bạn có chắc chắn muốn chuyển ${selectedOrders.length} đơn hàng sang trạng thái:\n"${selectedStatus}"?`)) return;

    const updatePayloads = [];
    
    if (selectedStatus === 'Đang giao hàng') {
        for (let order of selectedOrders) {
            let spxCode = prompt(`Trạng thái "Đang giao hàng" BẮT BUỘC có mã vận đơn.\nNhập mã vận đơn cho đơn hàng [ ${order.orderId} ]:`, "");
            if (spxCode !== null && spxCode.trim() !== "") {
                updatePayloads.push({ id: order.id, body: { status: selectedStatus, spx_tracking_code: spxCode.trim() } });
            } else {
                alert(`❌ Đã bỏ qua cập nhật đơn hàng ${order.orderId} do không nhập mã vận đơn.`);
            }
        }
    } else {
        for (let order of selectedOrders) {
            updatePayloads.push({ id: order.id, body: { status: selectedStatus } });
        }
    }

    if (updatePayloads.length === 0) return;

    try {
        const updatePromises = updatePayloads.map(async payload => {
            const res = await fetch(`${API_BASE_URL}/orders/${payload.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload.body)
            });
            if (!res.ok) throw new Error("Cập nhật thất bại");
            return res;
        });

        await Promise.all(updatePromises);
        alert(`✅ Cập nhật thành công ${updatePayloads.length} đơn hàng!`);
        
        const checkAllEl = document.getElementById('check-all-orders');
        if(checkAllEl && checkAllEl.checked) checkAllEl.click(); 
        
        window.loadOrders(); 
    } catch (err) {
        alert("Có lỗi xảy ra trong quá trình cập nhật trên máy chủ!");
    }
}

window.updateOrderStatus = async function(id, currentStatus, currentSpxCode) {
    const newStatus = prompt("Cập nhật trạng thái (VD: Đang giao hàng, Đã giao hàng...):", currentStatus || "Đang giao hàng");
    if (newStatus === null) return;

    const newSpxCode = prompt("Nhập Mã Vận Đơn (nếu có):", currentSpxCode || "");
    if (newSpxCode === null) return;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, spx_tracking_code: newSpxCode })
        });

        if (response.ok) {
            window.loadOrders(); 
        } else {
            alert("Lỗi khi cập nhật trên máy chủ!");
        }
    } catch (err) {
        alert("Lỗi kết nối API!");
    }
}

window.exportSPX = function() {
    const ordersStr = localStorage.getItem('morachi_orders');
    if (!ordersStr) {
        alert("Không tìm thấy dữ liệu đơn hàng trong bộ nhớ!");
        return;
    }

    const orders = JSON.parse(ordersStr);
    if (orders.length === 0) {
        alert("Chưa có đơn hàng nào để xuất!");
        return;
    }

    let csvContent = "\uFEFF";
    csvContent += "Mã Đơn,Tên Khách Hàng,Số Điện Thoại,Địa Chỉ Giao Hàng,Sản Phẩm Chi Tiết,Tổng Tiền,Trạng Thái,Mã Vận Đơn,Ngày Đặt\n";

    orders.forEach(o => {
        let orderId = o.order_id || "";
        let customerName = o.customer_info ? (o.customer_info.name || "") : "";
        let phone = o.customer_info ? (o.customer_info.phone || "") : "";
        let address = window.buildOrderAddress(o);
        
        let productsStr = "";
        if (o.items && o.items.length > 0) {
            productsStr = o.items.map(i => `${i.title} (${i.variant || 'Mặc định'}) - SL: ${i.quantity}`).join(" | ");
        }
        
        let total = o.total_amount || 0;
        let status = o.status || "";
        let spxCode = o.spx_tracking_code || "";
        
        let dateStr = "";
        let orderDate = o.created_at || o.date;
        if (orderDate) {
            let d = new Date(orderDate);
            if (!isNaN(d.getTime())) {
                dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
        }

        const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

        let row = [
            escapeCSV(orderId),
            escapeCSV(customerName),
            escapeCSV(phone),
            escapeCSV(address),
            escapeCSV(productsStr),
            total,
            escapeCSV(status),
            escapeCSV(spxCode),
            escapeCSV(dateStr)
        ];

        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    let fileName = `DanhSachDonHang_${new Date().toISOString().slice(0,10)}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener("DOMContentLoaded", () => {
    window.loadAdminProducts();
    window.bindAdminSearch();
});

window.onclick = function(event) {
    const modal = document.getElementById("productModal");
    if (event.target == modal) window.closeModal();
}