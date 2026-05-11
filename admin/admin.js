const API_BASE_URL = "/api";
let isEditing = false;
let allProductsData = [];

// 1. TẢI DANH SÁCH SẢN PHẨM
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        
        allProductsData = Array.isArray(products) ? products : [];
        renderTable(allProductsData);
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
    }
}

// 2. HIỂN THỊ BẢNG SẢN PHẨM
function renderTable(products) {
    const tbody = document.getElementById("admin-product-list");
    if (!tbody) return;
    
    if (products.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Không tìm thấy sản phẩm.</td></tr>";
        return;
    }

    tbody.innerHTML = products.map(p => {
        // Gom hiển thị biến thể ra ngoài bảng danh sách
        const variants = p.variants || [];
        const variantSummary = variants.length > 0 
            ? variants.map(v => `<span style="background:#f5f5f5; color:#555; padding:2px 6px; border-radius:4px; font-size:11px; margin-right:4px;">${v.name} (SL: ${v.stock || 0})</span>`).join("")
            : `<small style="color:#aaa;">Chưa có biến thể</small>`;

        return `
            <tr>
                <td><img src="${p.thumbnail}" style="width: 50px; height: 50px; object-fit: contain; border-radius:4px; border:1px solid #eee;" onerror="this.src='/images/icon-logo.png'"></td>
                <td>
                    <strong style="display:block; margin-bottom:6px;">${p.title}</strong>
                    <div>${variantSummary}</div>
                </td>
                <td>${p.brand}</td>
                <td style="color: #f57224; font-weight: bold;">${Number(p.current_price).toLocaleString()} đ</td>
                <td class="actions">
                    <button class="btn-icon edit-btn" style="border:none; background:#e3f2fd; color:#1976d2; padding:5px 10px; border-radius:4px; cursor:pointer;" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" style="border:none; background:#ffebee; color:#d32f2f; padding:5px 10px; border-radius:4px; cursor:pointer; margin-left:5px;" onclick="deleteProduct('${p.id}', '${p.brand}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join("");
}

// 3. XỬ LÝ TÌM KIẾM
function bindAdminSearch() {
    const searchInput = document.getElementById("admin-search-input");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        const filtered = allProductsData.filter(p => {
            const title = (p.title || "").toLowerCase();
            const brand = (p.brand || "").toLowerCase();
            return title.includes(keyword) || brand.includes(keyword);
        });
        renderTable(filtered);
    });
}

// 4. XÓA SẢN PHẨM
async function deleteProduct(id, brand) {
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm ${brand}?`)) return;
    try {
        const res = await fetch(`${API_BASE_URL}/products/${id}`, { method: "DELETE" });
        if (res.ok) { alert("Xóa thành công!"); loadAdminProducts(); }
    } catch (err) { alert("Lỗi hệ thống khi xóa!"); }
}

// 5. TẠO HTML DÒNG BIẾN THỂ (Giao diện chuẩn khớp với ảnh của bạn)
function addVariantRow(data = {}) {
    const container = document.getElementById("variants-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "variant-row";
    
    // Gắn giá trị cũ vào nếu đang trong chế độ Edit
    row.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end; background:#f9f9f9; padding: 15px; border-radius: 8px;">
            <div style="flex: 1.5;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Tên phân loại <span style="color:red">*</span></label>
                <input type="text" class="v-name" value="${data.name || ''}" placeholder="VD: 01 / Đỏ" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px; background: #fff;">
            </div>
            <div style="flex: 1;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Số lượng</label>
                <input type="number" class="v-stock" value="${data.stock !== undefined ? data.stock : 0}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
            </div>
            <div style="flex: 1.5;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Trạng thái</label>
                <select class="v-status" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
                    <option value="instock" ${data.status === 'instock' ? 'selected' : ''}>Sẵn hàng</option>
                    <option value="order" ${data.status === 'order' ? 'selected' : ''}>Hàng Order</option>
                    <option value="out" ${data.status === 'out' ? 'selected' : ''}>Hết hàng</option>
                </select>
            </div>
            <div style="flex: 1;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Ngày dự kiến</label>
                <input type="text" class="v-date" value="${data.date || ''}" placeholder="VD: 25/05" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
            </div>
            <div style="flex: 1.5;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Giá riêng</label>
                <input type="number" class="v-price" value="${data.price || ''}" placeholder="Giá VNĐ" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
            </div>
            <div style="flex: 1.5;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Ảnh riêng</label>
                <input type="file" class="v-file" accept="image/*" style="width:100%; margin-top:5px;">
                <input type="hidden" class="v-image-url" value="${data.image || ''}">
            </div>
            <button type="button" onclick="this.parentElement.remove()" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size: 20px; padding-bottom:10px; margin-left:10px;">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
        ${data.image ? `<div style="font-size: 12px; color: #2980b9; margin-top:-10px; margin-bottom:15px; margin-left:15px;">Ảnh hiện tại: <a href="${data.image}" target="_blank">Xem ảnh</a></div>` : ''}
    `;
    container.appendChild(row);
}

// 6. NẠP DỮ LIỆU ĐỂ SỬA
async function editProduct(id) {
    try {
        const p = allProductsData.find(item => item.id === id);
        
        if (p) {
            document.getElementById("product-id").value = p.id;
            document.getElementById("title").value = p.title || "";
            document.getElementById("brand").value = p.brand || "";
            document.getElementById("current_price").value = p.current_price || "";
            
            // Vẽ lại các biến thể đã lưu
            const container = document.getElementById("variants-container");
            if (container) {
                container.innerHTML = "";
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => addVariantRow(v));
                } else {
                    addVariantRow();
                }
            }
            openModal(true);
        }
    } catch (err) { alert("Lỗi khi tải thông tin sản phẩm!"); }
}

// 7. MỞ / ĐÓNG MODAL
function openModal(isEdit = false) {
    isEditing = isEdit;
    const msg = document.getElementById("message");
    if(msg) msg.innerText = "";
    
    const titleEl = document.getElementById("modalTitle");
    if(titleEl) titleEl.innerText = isEdit ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới";
    
    const modal = document.getElementById("productModal");
    if(modal) modal.style.display = "flex";
    
    if (!isEdit) {
        const form = document.getElementById("product-form");
        if(form) form.reset();
        document.getElementById("product-id").value = "";
        
        const container = document.getElementById("variants-container");
        if (container) {
            container.innerHTML = "";
            addVariantRow(); 
        }
    }
}

function closeModal() {
    const modal = document.getElementById("productModal");
    if(modal) modal.style.display = "none";
}

// 8. LƯU DỮ LIỆU (QUÉT VÀ GỬI BIẾN THỂ)
const form = document.getElementById("product-form");
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

            // --- BƯỚC QUAN TRỌNG: QUÉT TOÀN BỘ BIẾN THỂ ---
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

            // Gói dữ liệu
            const productData = {
                title: document.getElementById("title").value.trim(),
                brand: document.getElementById("brand").value.trim(),
                current_price: document.getElementById("current_price").value.trim(),
                status: "active",
                variants: variantsArray // GẮN BIẾN THỂ VÀO ĐÂY ĐỂ GỬI ĐI
            };

            if (imageUrl) productData.thumbnail = imageUrl;

            // In ra Log để bạn tự kiểm tra API
            console.log("🚀 Payload gửi lên API:", productData);

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
                setTimeout(() => { closeModal(); loadAdminProducts(); }, 1200);
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

// Khởi chạy
document.addEventListener("DOMContentLoaded", () => {
    loadAdminProducts();
    bindAdminSearch();
});