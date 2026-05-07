const API_BASE_URL = "/api";
let isEditing = false;

// 1. TẢI DANH SÁCH SẢN PHẨM
async function loadAdminProducts() {
    const tbody = document.getElementById("admin-product-list");
    tbody.innerHTML = "<tr><td colspan='5' style='text-align:center'>Đang tải dữ liệu...</td></tr>";

    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        const products = await response.json();
        
        tbody.innerHTML = products.map(p => `
            <tr>
                <td><img src="${p.thumbnail}" class="product-img-mini"></td>
                <td><strong>${p.title}</strong></td>
                <td>${p.brand}</td>
                <td>${Number(p.current_price).toLocaleString()} đ</td>
                <td class="actions">
                    <button class="btn-icon edit-btn" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" onclick="deleteProduct('${p.id}', '${p.brand}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = "<tr><td colspan='5' style='text-align:center; color:red'>Lỗi tải dữ liệu</td></tr>";
    }
}

// 2. XÓA SẢN PHẨM
async function deleteProduct(id, brand) {
    if (!confirm("Bạn có chắc chắn muốn xóa sản phẩm này?")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
            // Lưu ý: Code backend của bạn cần partition_key, ở đây là brand
        });

        if (response.ok) {
            alert("Đã xóa thành công!");
            loadAdminProducts(); // Tải lại danh sách
        }
    } catch (err) {
        alert("Lỗi khi xóa sản phẩm");
    }
}

// 3. MỞ MODAL ĐỂ THÊM/SỬA
function openModal(isEdit = false) {
    isEditing = isEdit;
    document.getElementById("modalTitle").innerText = isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm mới";
    document.getElementById("productModal").style.display = "flex";
    if (!isEdit) {
        document.getElementById("product-form").reset();
        document.getElementById("product-id").value = "";
    }
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
}

// 4. XỬ LÝ LƯU (SUBMIT FORM)
document.getElementById("product-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    const msg = document.getElementById("message");
    msg.innerText = "Đang xử lý...";

    try {
        const id = document.getElementById("product-id").value;
        const file = document.getElementById("thumbnail_file").files[0];
        let imageUrl = "";

        // Nếu có chọn file mới thì upload ảnh
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
            const resImg = await fetch(`${API_BASE_URL}/upload-image`, { method: "POST", body: formData });
            const dataImg = await resImg.json();
            imageUrl = dataImg.url;
        }

        const productData = {
            title: document.getElementById("title").value,
            brand: document.getElementById("brand").value,
            current_price: document.getElementById("current_price").value,
            old_price: document.getElementById("old_price").value,
            discount: document.getElementById("discount").value,
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
            msg.innerText = "Thành công!";
            setTimeout(() => { closeModal(); loadAdminProducts(); }, 1000);
        }
    } catch (err) {
        msg.innerText = "Có lỗi xảy ra!";
    }
});

// Chạy khi trang load
document.addEventListener("DOMContentLoaded", loadAdminProducts);