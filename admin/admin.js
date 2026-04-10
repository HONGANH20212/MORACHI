const API_BASE_URL = "http://localhost:7071/api";

async function uploadImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: "POST",
        body: formData
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.error || "Upload ảnh thất bại");
    }

    return result.url;
}

async function createProduct(product) {
    const response = await fetch(`${API_BASE_URL}/products`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(product)
    });

    const result = await response.json();

    if (!response.ok) {
        const message = result.error || (result.errors ? result.errors.join(", ") : "Tạo sản phẩm thất bại");
        throw new Error(message);
    }

    return result;
}

function bindImagePreview() {
    const fileInput = document.getElementById("thumbnail_file");
    const previewImage = document.getElementById("preview-image");

    if (!fileInput || !previewImage) return;

    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) {
            previewImage.style.display = "none";
            previewImage.src = "";
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        previewImage.src = objectUrl;
        previewImage.style.display = "block";
    });
}

document.getElementById("product-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    const messageBox = document.getElementById("message");
    messageBox.innerText = "Đang xử lý...";
    messageBox.style.color = "#333";

    try {
        const fileInput = document.getElementById("thumbnail_file");
        const file = fileInput.files[0];

        if (!file) {
            throw new Error("Vui lòng chọn ảnh sản phẩm");
        }

        const imageUrl = await uploadImage(file);

        const product = {
            title: document.getElementById("title").value.trim(),
            brand: document.getElementById("brand").value.trim(),
            thumbnail: imageUrl,
            current_price: document.getElementById("current_price").value.trim(),
            old_price: document.getElementById("old_price").value.trim(),
            discount: document.getElementById("discount").value.trim(),
            rating: document.getElementById("rating").value.trim() || "4.9",
            sold_text: document.getElementById("sold_text").value.trim() || "1k/tháng",
            status: "active"
        };

        await createProduct(product);

        messageBox.innerText = "Lưu sản phẩm thành công";
        messageBox.style.color = "green";
        this.reset();

        const previewImage = document.getElementById("preview-image");
        previewImage.src = "";
        previewImage.style.display = "none";
    } catch (error) {
        console.error(error);
        messageBox.innerText = error.message || "Có lỗi xảy ra";
        messageBox.style.color = "red";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    bindImagePreview();
});