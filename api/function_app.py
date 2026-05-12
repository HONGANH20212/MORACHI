var API_BASE_URL = "/api";
var isEditing = false;
var allProductsData = [];

// =========================================================
// PHẦN 1: QUẢN LÝ KHO SẢN PHẨM
// =========================================================

window.loadAdminProducts = async function() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        
        allProductsData = Array.isArray(products) ? products : [];
        window.renderTable(allProductsData);
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
    }
}

window.renderTable = function(products) {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Không tìm thấy sản phẩm.</td></tr>";
        return;
    }

    tbody.innerHTML = products.map(p => {
        const variants = p.variants || [];
        const variantSummary = variants.length > 0 
            ? variants.map(v => `<span style="background:#f5f5f5; color:#555; padding:2px 6px; border-radius:4px; font-size:11px; margin-right:4px; display:inline-block; margin-bottom:2px;">${v.name} (SL: ${v.stock || 0})</span>`).join("")
            : `<small style="color:#aaa;">Chưa có biến thể</small>`;

        return `
            <tr>
                <td><img src="${p.thumbnail}" style="width: 50px; height: 50px; object-fit: contain; border-radius:4px; border:1px solid #eee;" onerror="this.src='/images/icon-logo.png'"></td>
                <td>
                    <strong style="display:block; margin-bottom:6px;">${p.title}</strong>
                    <div>${variantSummary}</div>
                </td>
                <td>${p.brand}</td>
                <td style="color: #f57224; font-weight: bold;">${Number(p.current_price).toLocaleString('vi-VN')} đ</td>
                <td class="actions">
                    <button class="btn-icon edit-btn" style="border:none; background:#e3f2fd; color:#1976d2; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="window.editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" style="border:none; background:#ffebee; color:#d32f2f; padding:5px 10px; border-radius:4px; cursor:pointer; margin-left:5px;" onclick="window.deleteProduct('${p.id}', '${p.brand}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

window.bindAdminSearch = function() {
    const searchInput = document.getElementById("admin-search-input");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        const filtered = allProductsData.filter(p => {
            const title = (p.title || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            return title.includes(keyword) || brand.includes(keyword);
        });
        window.renderTable(filtered);
    });
}

window.deleteProduct = async function(id, brand) {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${brand}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: "DELETE" });
        if (res.ok) { alert("Xóa thành công!"); window.loadAdminProducts(); }
    } catch (err) { alert("Lỗi hệ thống khi xóa!"); }
}

window.addVariantRow = function(data = {}) {
    const container = document.getElementById("variants-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "variant-row";
    
    row.innerHTML = `
        <div>
            <label style="font-weight:bold; color:#555;">Phân loại <span style="color:red">*</span></label>
            <input type="text" class="v-name" value="${data.name || ''}" placeholder="Nhập tên..." required>
        </div>
        <div>
            <label style="font-weight:bold; color:#555;">Số lượng</label>
            <input type="number" class="v-stock" value="${data.stock !== undefined ? data.stock : 0}">
        </div>
        <div>
            <label style="font-weight:bold; color:#555;">Trạng thái</label>
            <select class="v-status">
                <option value="instock" ${data.status === 'instock' ? 'selected' : ''}>Sẵn hàng</option>
                <option value="order" ${data.status === 'order' ? 'selected' : ''}>Hàng Order</option>
                <option value="out" ${data.status === 'out' ? 'selected' : ''}>Hết hàng</option>
            </select>
        </div>
        <div>
            <label style="font-weight:bold; color:#555;">Dự kiến</label>
            <input type="text" class="v-date" value="${data.date || ''}" placeholder="VD: 25/05">
        </div>
        <div>
            <label style="font-weight:bold; color:#555;">Giá riêng</label>
            <input type="number" class="v-price" value="${data.price || ''}" placeholder="Giá VNĐ">
        </div>
        <div>
            <label style="font-weight:bold; color:#555;">Ảnh riêng</label>
            <input type="file" class="v-file" accept="image/*" style="font-size: 11px; padding: 4px;">
            <input type="hidden" class="v-image-url" value="${data.image || ''}">
        </div>
        <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size: 18px; padding-bottom: 5px;" title="Xóa dòng này">
            <i class="fas fa-trash-alt"></i>
        </button>
        ${data.image ? `<div style="grid-column: 1/-1; margin-top: 5px; font-size: 12px;"><a href="${data.image}" target="_blank" style="color:#3498db; text-decoration:none;"><i class="fas fa-image"></i> Xem ảnh hiện tại đang lưu</a></div>` : ''}
    `;
    container.appendChild(row);
}

window.editProduct = async function(id) {
    try {
        const p = allProductsData.find(item => item.id === id);
        
        if (p) {
            document.getElementById("product-id").value = p.id;
            document.getElementById("title").value = p.title || "";
            document.getElementById("brand").value = p.brand || "";
            document.getElementById("current_price").value = p.current_price || "";
            
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
        msg.style.color = "#333";

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
                
                if (!vNameInput || vNameInput.value.trim() === "") {
                    alert("Vui lòng nhập tên Phân loại (Ví dụ: Đỏ, 50ml...) vào dòng biến thể!\n\nNếu bạn không muốn có biến thể, hãy bấm biểu tượng 'Thùng Rác' màu đỏ để xóa dòng đó đi trước khi lưu.");
                    msg.innerText = "";
                    return; 
                }

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
                status: "active",
                variants: variantsArray 
            };

            if (imageUrl) productData.thumbnail = imageUrl;

            const url = isEditing ? `${API_BASE_URL}/products/${id}` : `${API_BASE_URL}/products`;
            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(productData)
            });

            if (res.ok) {
                msg.innerText = isEditing ? "Cập nhật thành công!" : "Thêm mới thành công!";
                msg.style.color = "green";
                setTimeout(() => { window.closeModal(); window.loadAdminProducts(); }, 1200);
            } else {
                throw new Error("API backend từ chối lưu dữ liệu");
            }
        } catch (err) {
            msg.innerText = err.message || "Có lỗi xảy ra!";
            msg.style.color = "red";
            console.error(err);
        }
    });
}

// =========================================================
// PHẦN 2: QUẢN LÝ ĐƠN HÀNG VÀ XUẤT FILE EXCEL SPX
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

    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding: 40px;'>Đang tải đơn hàng từ máy chủ...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/orders`);
        if (!response.ok) throw new Error("API lỗi");
        const orders = await response.json();
        
        localStorage.setItem('morachi_orders', JSON.stringify(orders));

        if (!orders || orders.length === 0) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; padding: 40px;'>Chưa có đơn hàng nào.</td></tr>";
            return;
        }

        tbody.innerHTML = orders.map(o => {
            const c = o.customer_info || {};
            const items = o.items || [];
            let itemNames = items.map(i => `<div style="font-size:12px;">• ${i.title} (${i.variant}) x${i.quantity}</div>`).join("");
            let statusColor = o.payment_method === 'cod' ? '#f39c12' : '#3498db';

            let spxHtml = o.spx_tracking_code 
                ? `<div style="margin-top:5px; color:#27ae60; font-size:11px;"><i class="fas fa-truck"></i> SPX: <b>${o.spx_tracking_code}</b></div>` 
                : `<div style="margin-top:5px; color:#aaa; font-size:11px;">Chưa có mã SPX</div>`;

            return `
                <tr>
                    <td style="font-weight:bold; color:#111;">${o.order_id || 'N/A'}</td>
                    <td>
                        <div style="font-weight:bold;">${c.name || 'N/A'}</div>
                        <div style="font-size:12px; color:#555;">📞 ${c.phone || ''}</div>
                        <div style="font-size:11px; color:#888;">📍 ${c.address || ''}, ${c.ward || ''}, ${c.dist || ''}, ${c.prov || ''}</div>
                    </td>
                    <td>${itemNames}</td>
                    <td style="font-weight:bold; color:#e74c3c;">${Number(o.total_amount || 0).toLocaleString('vi-VN')} đ</td>
                    <td>
                        <span style="background:${statusColor}; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold;">
                            ${o.status || 'Mới'}
                        </span>
                        ${spxHtml}
                    </td>
                    <td class="actions">
                        <button class="btn-icon edit-btn" title="Cập nhật Trạng thái & Mã SPX" onclick="window.updateOrderStatus('${o.id}', '${o.status || ''}', '${o.spx_tracking_code || ''}')"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error("Lỗi lấy đơn hàng:", err);
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối máy chủ để lấy Đơn Hàng!</td></tr>";
    }
}

window.exportSPX = function() {
    const orders = JSON.parse(localStorage.getItem('morachi_orders') || '[]');
    if (orders.length === 0) {
        alert("Chưa có đơn hàng nào để xuất!");
        return;
    }

    const header = [
        "*Mã đơn hàng", "*Tên người nhận", "*Số điện thoại", "*Tỉnh/Thành Phố", 
        "*Quận/Huyện", "*Xã/Phường", "*Địa chỉ chi tiết", "Lưu ý về địa chỉ", 
        "Mã bưu chính", "*Tên sản phẩm", 
        "Số lượng (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)", 
        "Giá tiền (Thông tin bắt buộc khi chọn Giao hàng một phần & Thu COD)", 
        "*Tổng cân nặng bưu gửi (KG)", "Chiều dài (CM)", "Chiều rộng (CM)", 
        "Chiều cao (CM)", "Mã khách hàng", "*Giá trị đơn hàng", 
        "*Giao hàng một phần (Y/N)", "*Cho phép thử hàng (Y/N)", 
        "\"*Cho xem hàng, không cho thử (Y/N)\"", "Thu phí từ chối nhận hàng (Y/N)", 
        "Phí từ chối nhận hàng cần thu", "*Thu COD (Y/N)", "Số tiền COD", 
        "bưu gửi giá trị cao (Y/N)", "*Hình thức thanh Toán", "Lưu ý giao hàng", 
        "Nhắc nhở điền đúng số tiền COD", 
        "\"Đơn chỉ hoàn thành nếu ở dưới hiện \"\"Đủ điều kiện\"\"\""
    ];

    const escapeCSV = (str) => {
        if (str === null || str === undefined) return '""';
        return '"' + String(str).replace(/"/g, '""') + '"';
    };

    let csvContent = "\uFEFF" + header.join(",") + "\n";

    orders.forEach(o => {
        const c = o.customer_info || {};
        const items = o.items || [];
        
        const itemsStr = items.map(i => `${i.title} (${i.variant}) x${i.quantity}`).join(" + ");
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        
        const isCOD = o.payment_method === 'cod' ? "Y" : "N";
        const codAmount = o.payment_method === 'cod' ? (o.total_amount || 0) : 0;

        const row = [
            escapeCSV(o.order_id),
            escapeCSV(c.name),
            escapeCSV(c.phone),
            escapeCSV(c.prov),
            escapeCSV(c.dist),
            escapeCSV(c.ward),
            escapeCSV(c.address),
            '""', '""',
            escapeCSV(itemsStr),
            totalQty,
            o.total_amount || 0,
            "1", "20", "10", "10",
            '""',
            o.total_amount || 0,
            '"N"', '"N"', '"Y"', '"N"',
            '""',
            escapeCSV(isCOD),
            codAmount,
            '"N"',
            '"Người gửi trả"',
            '"Cho xem hàng"',
            '""',
            '"Đủ điều kiện"'
        ];

        csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `DonHang_SPX_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.updateOrderStatus = async function(id, currentStatus, currentSpxCode) {
    const newStatus = prompt("Cập nhật trạng thái (VD: Đang giao hàng, Đã hoàn thành...):", currentStatus || "Đang giao hàng");
    if (newStatus === null) return;

    const newSpxCode = prompt("Nhập Mã Vận Đơn Shopee Xpress (nếu có, để in ra cho khách tự tra):", currentSpxCode || "");
    if (newSpxCode === null) return;

    try {
        const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, spx_tracking_code: newSpxCode })
        });

        if (response.ok) {
            alert("Đã cập nhật trạng thái đơn hàng thành công!");
            window.loadOrders(); 
        } else {
            alert("Lỗi khi cập nhật trên máy chủ!");
        }
    } catch (err) {
        alert("Lỗi kết nối API!");
    }
}

// Khởi chạy mặc định khi trang load
document.addEventListener("DOMContentLoaded", () => {
    window.loadAdminProducts();
    window.bindAdminSearch();
});

// Đóng modal khi click nền xám
window.onclick = function(event) {
    const modal = document.getElementById("productModal");
    if (event.target == modal) window.closeModal();
}