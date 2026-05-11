const API_BASE_URL = "/api";
let isEditing = false;
let allProductsData = [];

// 1. TẢI DANH SÁCH SẢN PHẨM
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-list");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        
        // Lưu dữ liệu vào biến toàn cục để dùng cho việc tìm kiếm
        allProductsData = Array.isArray(products) ? products : [];
        
        renderTable(allProductsData);
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
    }
}

// 2. HÀM RENDER BẢNG (Tách riêng để dùng chung cho tìm kiếm)
function renderTable(products) {
    const tbody = document.getElementById("admin-product-list");
    
    if (products.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Không tìm thấy sản phẩm nào phù hợp.</td></tr>";
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr>
            <td><img src="${p.thumbnail}" class="product-img-mini" onerror="this.src='/images/icon-logo.png'"></td>
            <td><strong>${p.title}</strong></td>
            <td>${p.brand}</td>
            <td style="color: #f57224; font-weight: bold;">${Number(p.current_price).toLocaleString()} đ</td>
            <td class="actions">
                <button class="btn-icon edit-btn" title="Sửa" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-icon delete-btn" title="Xóa" onclick="deleteProduct('${p.id}', '${p.brand}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join("");
}

// 3. XỬ LÝ SỰ KIỆN TÌM KIẾM
function bindAdminSearch() {
    const searchInput = document.getElementById("admin-search-input");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        
        // Lọc danh sách dựa trên tên sản phẩm hoặc thương hiệu
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
    if (!confirm(`Bạn có chắc chắn muốn xóa sản phẩm thương hiệu ${brand} này?`)) return;

    try {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        if (response.ok) {
            alert("Đã xóa sản phẩm thành công!");
            loadAdminProducts();
        } else {
            alert("Không thể xóa sản phẩm. Vui lòng thử lại.");
        }
    } catch (err) {
        console.error(err);
        alert("Lỗi hệ thống khi xóa!");
    }
}

// --- HÀM MỚI: TẠO GIAO DIỆN DÒNG BIẾN THỂ ---
// Lưu ý: Nút "Thêm biến thể mới" trong HTML của bạn cần gọi hàm onclick="addVariantRow()"
function addVariantRow(data = {}) {
    const container = document.getElementById("variants-container");
    if (!container) return;

    const row = document.createElement("div");
    row.className = "variant-row";
    
    // Tạo cấu trúc giao diện nhập biến thể tương thích với form của bạn
    row.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: flex-end; background:#f9f9f9; padding: 15px; border-radius: 8px;">
            <div style="flex: 1.5;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Tên phân loại</label>
                <input type="text" class="v-name" value="${data.name || ''}" placeholder="VD: 473ml / Đỏ" required style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
            </div>
            <div style="flex: 1;">
                <label style="font-size:12px; color:#666; font-weight:bold;">Số lượng</label>
                <input type="number" class="v-stock" value="${data.stock || 0}" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:4px; margin-top:5px;">
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


// 5. LẤY CHI TIẾT ĐỂ SỬA (Đã Cập Nhật Để Nạp Biến Thể)
async function editProduct(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        const p = products.find(item => item.id === id);
        
        if (p) {
            document.getElementById("product-id").value = p.id;
            document.getElementById("title").value = p.title;
            document.getElementById("brand").value = p.brand;
            document.getElementById("current_price").value = p.current_price;
            document.getElementById("old_price").value = p.old_price || "";
            document.getElementById("discount").value = p.discount || "";
            
            // --- NẠP LẠI DỮ LIỆU CÁC BIẾN THỂ KHI ẤN SỬA ---
            const variantsContainer = document.getElementById("variants-container");
            if (variantsContainer) {
                variantsContainer.innerHTML = ""; // Xóa dữ liệu rỗng mặc định
                if (p.variants && p.variants.length > 0) {
                    p.variants.forEach(v => addVariantRow(v)); // Vẽ lại các dòng dựa trên Database
                } else {
                    addVariantRow(); // Nếu ko có biến thể nào thì hiện 1 ô trống
                }
            }

            openModal(true);
        }
    } catch (err) {
        alert("Lỗi khi tải thông tin sản phẩm cần sửa!");
    }
}

// 6. ĐIỀU KHIỂN MODAL
function openModal(isEdit = false) {
    isEditing = isEdit;
    const msg = document.getElementById("message");
    if(msg) msg.innerText = "";
    
    document.getElementById("modalTitle").innerText = isEdit ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới";
    document.getElementById("productModal").style.display = "flex";
    
    if (!isEdit) {
        document.getElementById("product-form").reset();
        document.getElementById("product-id").value = "";
        
        // Reset khu vực biến thể về mặc định 1 dòng trống
        const variantsContainer = document.getElementById("variants-container");
        if (variantsContainer) {
            variantsContainer.innerHTML = "";
            addVariantRow(); 
        }
    }
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
}

// 7. LƯU (POST HOẶC PUT) - ĐÃ FIX ĐỂ LƯU DỮ LIỆU BIẾN THỂ & ẢNH
document.getElementById("product-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const msg = document.getElementById("message") || document.createElement('div');
    msg.innerText = "Đang xử lý dữ liệu và tải ảnh...";
    msg.style.color = "#333";

    try {
        const id = document.getElementById("product-id").value;
        const file = document.getElementById("thumbnail_file").files[0];
        let imageUrl = "";

        // Nếu có chọn ảnh chính mới thì upload
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            const resImg = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: formData });
            if (!resImg.ok) throw new Error("Lỗi upload ảnh chính");
            const dataImg = await resImg.json();
            imageUrl = dataImg.url;
        }

        // --- QUÉT VÀ THU THẬP DỮ LIỆU TỪ CÁC DÒNG BIẾN THỂ ---
        const variantsArray = [];
        const variantRows = document.querySelectorAll(".variant-row");
        
        for (let row of variantRows) {
            const vName = row.querySelector(".v-name") ? row.querySelector(".v-name").value.trim() : "";
            if (!vName) continue; // Bỏ qua nếu dòng này chưa nhập tên

            const vStock = row.querySelector(".v-stock") ? parseInt(row.querySelector(".v-stock").value) : 0;
            const vStatus = row.querySelector(".v-status") ? row.querySelector(".v-status").value : "instock";
            const vDate = row.querySelector(".v-date") ? row.querySelector(".v-date").value.trim() : "";
            const vPrice = row.querySelector(".v-price") && row.querySelector(".v-price").value ? parseInt(row.querySelector(".v-price").value) : null;
            
            const vFile = row.querySelector(".v-file");
            let vImageUrl = row.querySelector(".v-image-url") ? row.querySelector(".v-image-url").value : "";

            // Upload ảnh của biến thể nếu người dùng có chọn file
            if (vFile && vFile.files && vFile.files[0]) {
                msg.innerText = `Đang tải ảnh phân loại: ${vName}...`;
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
                name: vName,
                stock: vStock || 0,
                status: vStatus,
                date: vDate,
                price: vPrice,
                image: vImageUrl
            });
        }

        const productData = {
            title: document.getElementById("title").value.trim(),
            brand: document.getElementById("brand").value.trim(),
            current_price: document.getElementById("current_price").value.trim(),
            old_price: document.getElementById("old_price").value.trim(),
            discount: document.getElementById("discount").value.trim(),
            status: "active",
            variants: variantsArray // <-- CHÌA KHÓA: Đính kèm biến thể để gửi lưu vào Database
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
            setTimeout(() => { closeModal(); loadAdminProducts(); }, 1200);
        } else {
            throw new Error("Lỗi lưu dữ liệu máy chủ");
        }
    } catch (err) {
        msg.innerText = err.message || "Có lỗi xảy ra!";
        msg.style.color = "red";
    }
});

// Khởi chạy hệ thống Admin
document.addEventListener("DOMContentLoaded", () => {
    loadAdminProducts();
    bindAdminSearch(); // Kích hoạt thanh tìm kiếm
});

// Đóng modal khi click ra ngoài vùng trắng
window.onclick = function(event) {
    const modal = document.getElementById("productModal");
    if (event.target == modal) closeModal();
}