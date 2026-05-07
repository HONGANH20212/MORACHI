const API_BASE_URL = "/api";
let isEditing = false;

// 1. TẢI DANH SÁCH SẢN PHẨM
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-list");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Đang tải dữ liệu hệ thống...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        
        if (products.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding: 40px;'>Chưa có sản phẩm nào.</td></tr>";
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
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red; padding: 40px;'>Lỗi kết nối API!</td></tr>";
    }
}

// 2. XÓA SẢN PHẨM
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

// 3. LẤY CHI TIẾT ĐỂ SỬA
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
            
            openModal(true);
        }
    } catch (err) {
        alert("Lỗi khi tải thông tin sản phẩm cần sửa!");
    }
}

// 4. ĐIỀU KHIỂN MODAL
function openModal(isEdit = false) {
    isEditing = isEdit;
    const msg = document.getElementById("message");
    msg.innerText = "";
    document.getElementById("modalTitle").innerText = isEdit ? "Cập nhật sản phẩm" : "Thêm sản phẩm mới";
    document.getElementById("productModal").style.display = "flex";
    
    if (!isEdit) {
        document.getElementById("product-form").reset();
        document.getElementById("product-id").value = "";
    }
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
}

// 5. LƯU (POST HOẶC PUT)
document.getElementById("product-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const msg = document.getElementById("message");
    msg.innerText = "Đang xử lý...";
    msg.style.color = "#333";

    try {
        const id = document.getElementById("product-id").value;
        const file = document.getElementById("thumbnail_file").files[0];
        let imageUrl = "";

        // Nếu có chọn ảnh mới thì upload
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            const resImg = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: formData });
            if (!resImg.ok) throw new Error("Lỗi upload ảnh");
            const dataImg = await resImg.json();
            imageUrl = dataImg.url;
        }

        const productData = {
            title: document.getElementById("title").value.trim(),
            brand: document.getElementById("brand").value.trim(),
            current_price: document.getElementById("current_price").value.trim(),
            old_price: document.getElementById("old_price").value.trim(),
            discount: document.getElementById("discount").value.trim(),
            status: "active"
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
            throw new Error("Lỗi lưu dữ liệu");
        }
    } catch (err) {
        msg.innerText = err.message || "Có lỗi xảy ra!";
        msg.style.color = "red";
    }
});

// Khởi chạy
document.addEventListener("DOMContentLoaded", loadAdminProducts);

// Đóng modal khi click ra ngoài vùng trắng
window.onclick = function(event) {
    const modal = document.getElementById("productModal");
    if (event.target == modal) closeModal();
}