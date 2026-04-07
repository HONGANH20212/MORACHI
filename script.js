// script.js - File xử lý tự động lấy sản phẩm từ CMS
async function fetchProducts() {
    try {
        // Sử dụng API của GitHub để lấy danh sách file trong thư mục 'products'
        // Cần đảm bảo kho MORACHI của bạn đang ở chế độ Public để API này hoạt động tốt nhất.
        const repoUrl = "https://api.github.com/repos/HONGANH20212/MORACHI/contents/products";
        const response = await fetch(repoUrl);
        
        if (!response.ok) throw new Error("Chưa có sản phẩm nào hoặc lỗi kết nối.");
        
        const files = await response.json();
        const productList = document.getElementById('product-list');
        
        if (!productList) return; // Nếu không tìm thấy vùng chứa, dừng chạy lệnh

        // Xóa nội dung hiển thị "Đang cập nhật..."
        productList.innerHTML = '';

        // Duyệt qua từng file .md trong thư mục products
        for (const file of files) {
            if (file.name.endsWith('.md')) {
                const fileRes = await fetch(file.download_url);
                const text = await fileRes.text();
                
                // Tách dữ liệu YAML từ file Markdown
                const yamlData = text.split('---')[1];
                if (yamlData) {
                    const data = {};
                    yamlData.split('\n').forEach(line => {
                        const colonIndex = line.indexOf(':');
                        if (colonIndex > 0) {
                            const key = line.substring(0, colonIndex).trim();
                            let value = line.substring(colonIndex + 1).trim();
                            // Loại bỏ dấu nháy kép ở đầu và cuối nếu có
                            value = value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                            data[key] = value;
                        }
                    });

                    // Xử lý dữ liệu để tạo mã HTML hiển thị
                    const discountHtml = data.discount ? `<div class="discount-badge">${data.discount}</div>` : '';
                    const oldPriceHtml = data.old_price ? `<span class="old-price">${data.old_price}</span>` : '';
                    
                    // Xử lý đường dẫn ảnh
                    const imgSrc = data.thumbnail && data.thumbnail.startsWith('/') ? data.thumbnail.substring(1) : data.thumbnail;

                    // Chèn HTML
                    const productHtml = `
                        <div class="product-card">
                            ${discountHtml}
                            <img src="${imgSrc || 'https://via.placeholder.com/200'}" alt="${data.title}" class="product-img">
                            <div class="product-info">
                                <div class="brand">${data.brand || ''}</div>
                                <h3 class="product-title">${data.title || 'Sản phẩm chưa có tên'}</h3>
                                <div class="price-group">
                                    <span class="current-price">${data.current_price || 'Liên hệ'}</span>
                                    ${oldPriceHtml}
                                </div>
                                <div class="product-rating">
                                    <span class="stars"><i class="fas fa-star"></i> ${data.rating || '5.0'}</span>
                                    <span class="sold">${data.sold || 'Mới'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    productList.innerHTML += productHtml;
                }
            }
        }
    } catch (error) {
        console.log("Lỗi:", error.message);
        const list = document.getElementById('product-list');
        if(list && list.innerHTML === '') {
            list.innerHTML = "<p style='grid-column: 1/-1; text-align: center;'>Chưa có sản phẩm nào. Hãy vào trang /admin để thêm nhé.</p>";
        }
    }
}

// Gọi hàm khi nội dung trang HTML đã tải xong (để tránh lỗi không tìm thấy ID)
document.addEventListener('DOMContentLoaded', fetchProducts);