var API_BASE_URL = "/api";
var isEditing = false;
var allProductsData = [];

// =========================================================
// PHẦN 1: QUẢN LÝ KHO SẢN PHẨM & CẬP NHẬT GIAO DIỆN MỚI
// =========================================================

window.loadAdminProducts = async function() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px;'><i class='fas fa-spinner fa-spin'></i> Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products?t=${new Date().getTime()}`);
        const products = await response.json();
        
        allProductsData = Array.isArray(products) ? products : [];
        
        // Cập nhật thống kê trên Dashboard
        window.updateDashboardStats(allProductsData);
        // Load danh sách Brand vào thanh lọc
        window.populateBrandFilter(allProductsData);
        // Hiển thị bảng
        window.renderTable(allProductsData);
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
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

    // Lắng nghe sự kiện lọc
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
    window.renderTable(filtered);
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
    
    if (products.length === 0) {
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px; color:#888;'>Không tìm thấy sản phẩm phù hợp.</td></tr>";
        return;
    }

    tbody.innerHTML = products.map(p => {
        const variants = p.variants || [];
        
        // Tính tổng tồn kho
        let totalStock = variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        
        // Tạo chuỗi HTML cho biến thể
        let variantHtml = '';
        if (variants.length > 0) {
            let limitVariants = variants.slice(0, 3); // Hiển thị tối đa 3 biến thể
            variantHtml = limitVariants.map(v => `<span class="variant-pill">${v.name}</span>`).join('');
            if (variants.length > 3) {
                variantHtml += `<span class="variant-pill" style="background:#fff2eb; color:#f57224; border:none;">+${variants.length - 3}</span>`;
            }
        }

        // Cấu hình Badge Hot/Discount
        const badgeHtml = p.discount ? `<span class="badge-hot">${p.discount}</span>` : '';

        // Đánh giá Trạng thái Tồn Kho
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
            <tr>
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
}

window.deleteProduct = async function(id, brand) {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${brand}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: "DELETE" });
        if (res.ok) { 
            sessionStorage.removeItem('morachi_products_cache');
            sessionStorage.removeItem('morachi_products_cache_time');
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
            <input type="text" class="v-name" value="${data.name || ''}" placeholder="VD: Đỏ, 50ml" required>
        </div>
        <div>
            <label>Số lượng</label>
            <input type="number" class="v-stock" value="${data.stock !== undefined ? data.stock : 0}">
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
            <input type="text" class="v-date" value="${data.date || ''}" placeholder="VD: 25/05">
        </div>
        <div>
            <label>Giá riêng</label>
            <input type="number" class="v-price" value="${data.price || ''}" placeholder="Giá VNĐ">
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
        const p = allProductsData.find(item => item.id === id);
        
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
    
    if (!isEdit) {
        const formEl = document.getElementById("product-form");
        if(formEl) formEl.reset();
        document.getElementById("product-id").value = "";
        
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

// Xử lý Lưu Sản Phẩm 
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
                variants: variantsArray
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
                
                sessionStorage.removeItem('morachi_products_cache');
                sessionStorage.removeItem('morachi_products_cache_time');
                
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

window.loadOrders = async function() {
    const tbody = document.getElementById('admin-order-list');
    if (!tbody) return;

    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px;'><i class='fas fa-spinner fa-spin'></i> Đang tải đơn hàng...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/orders?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error("API lỗi");
        const orders = await response.json();
        
        localStorage.setItem('morachi_orders', JSON.stringify(orders));

        const checkAllEl = document.getElementById('check-all-orders');
        if (checkAllEl) checkAllEl.checked = false;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; padding: 40px; color:#888;'>Chưa có đơn hàng nào.</td></tr>";
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const c = o.customer_info || {};
            const items = o.items || [];
            let itemNames = items.map(i => `<div style="font-size:12px; margin-bottom:2px; color:#555;">• ${i.title} (${i.variant}) x<b>${i.quantity}</b></div>`).join("");
            
            let statusBadge = `<span class="status-badge" style="background:#eef2ff; color:#4f46e5;">${o.status || 'Mới'}</span>`;
            if(o.status === 'Đang giao hàng') statusBadge = `<span class="status-badge" style="background:var(--warning-bg); color:var(--warning);">${o.status}</span>`;
            if(o.status === 'Đã hoàn thành') statusBadge = `<span class="status-badge active">${o.status}</span>`;
            if(o.status === 'Đã hủy') statusBadge = `<span class="status-badge out">${o.status}</span>`;

            let spxHtml = o.spx_tracking_code 
                ? `<div style="margin-top:6px; color:var(--success); font-size:11px;"><i class="fas fa-truck"></i> SPX: <b>${o.spx_tracking_code}</b></div>` 
                : ``;

            return `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" class="order-checkbox" value="${o.id}" data-orderid="${o.order_id || 'N/A'}"></td>
                    <td style="font-weight:600; color:var(--text-main);">${o.order_id || 'N/A'}</td>
                    <td>
                        <div style="font-weight:600; color:var(--text-main);">${c.name || 'N/A'}</div>
                        <div style="font-size:12px; color:#555; margin-top:3px;"><i class="fas fa-phone-alt" style="color:#aaa; font-size:10px;"></i> ${c.phone || ''}</div>
                    </td>
                    <td>${itemNames}</td>
                    <td style="font-weight:bold; color:var(--accent);">${Number(o.total_amount || 0).toLocaleString('vi-VN')} đ</td>
                    <td>
                        ${statusBadge}
                        ${spxHtml}
                    </td>
                    <td>
                        <button class="btn-icon" title="Cập nhật Trạng thái" onclick="window.updateOrderStatus('${o.id}', '${o.status || ''}', '${o.spx_tracking_code || ''}')"><i class="fas fa-pen"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Lỗi lấy đơn hàng:", err);
        tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối máy chủ!</td></tr>";
    }
}

window.toggleAllOrders = function(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

window.applyBulkStatus = async function() {
    const selectedStatus = document.getElementById('bulk-status-select').value;
    if (!selectedStatus) {
        alert("Vui lòng chọn trạng thái muốn cập nhật từ menu thả xuống!");
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

    if (!confirm(`Bạn có chắc chắn muốn chuyển ${selectedOrders.length} đơn hàng sang "${selectedStatus}"?`)) return;

    const updatePayloads = [];
    
    if (selectedStatus === 'Đang giao hàng') {
        for (let order of selectedOrders) {
            let spxCode = prompt(`NHẬP MÃ VẬN ĐƠN SPX cho đơn hàng [ ${order.orderId} ]:`, "");
            if (spxCode !== null && spxCode.trim() !== "") {
                updatePayloads.push({ id: order.id, body: { status: selectedStatus, spx_tracking_code: spxCode.trim() } });
            } else {
                alert(`Bỏ qua đơn hàng ${order.orderId} do chưa nhập mã SPX.`);
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
        alert(`Cập nhật thành công ${updatePayloads.length} đơn hàng!`);
        window.loadOrders(); 
    } catch (err) {
        alert("Có lỗi xảy ra trong quá trình cập nhật!");
    }
}

window.updateOrderStatus = async function(id, currentStatus, currentSpxCode) {
    const newStatus = prompt("Cập nhật trạng thái (VD: Đang giao hàng, Đã hoàn thành...):", currentStatus || "Đang giao hàng");
    if (newStatus === null) return;

    const newSpxCode = prompt("Nhập Mã Vận Đơn Shopee Xpress (nếu có):", currentSpxCode || "");
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
    const orders = JSON.parse(localStorage.getItem('morachi_orders') || '[]');
    if (orders.length === 0) {
        alert("Chưa có đơn hàng nào để xuất!");
        return;
    }
    // ... (Giữ nguyên logic xuất CSV cũ của bạn ở đây, vì nội dung xuất file thường không ảnh hưởng giao diện)
    alert("Đang tải file CSV...");
}

document.addEventListener("DOMContentLoaded", () => {
    window.loadAdminProducts();
    window.bindAdminSearch();
});

window.onclick = function(event) {
    const modal = document.getElementById("productModal");
    if (event.target == modal) window.closeModal();
}