// === HỆ THỐNG GIỎ HÀNG BẰNG LOCALSTORAGE ===

// 1. Khởi tạo giỏ hàng từ bộ nhớ trình duyệt
let cart = JSON.parse(localStorage.getItem('morachi_cart')) || [];

// 2. Lưu giỏ hàng
function saveCart() {
    localStorage.setItem('morachi_cart', JSON.stringify(cart));
    updateCartUI();
}

// 3. Mở / Đóng giao diện giỏ hàng
function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    
    if (drawer && overlay) {
        drawer.classList.toggle('active');
        overlay.classList.toggle('active');
        updateCartUI(); // Cập nhật lại giao diện mỗi khi mở
    }
}

// 4. Thêm sản phẩm vào giỏ hàng
function addToCart(product) {
    // Cấu trúc truyền vào: { id, title, brand, image, variant, price }
    const existingItem = cart.find(item => item.id === product.id && item.variant === product.variant);
    
    if (existingItem) {
        existingItem.quantity += 1; // Nếu đã có loại này trong giỏ -> tăng số lượng
    } else {
        cart.push({ ...product, quantity: 1 }); // Nếu chưa có -> thêm mới
    }
    
    saveCart(); // Lưu vào bộ nhớ
    toggleCart(); // Tự động trượt giỏ hàng ra cho khách xem
}

// 5. Cập nhật giao diện giỏ hàng (Số lượng trên icon + Danh sách)
function updateCartUI() {
    // Cập nhật số đếm màu cam trên Header
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
        countEl.innerText = totalQty;
    }

    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    
    if (!itemsContainer || !totalEl) return;

    // Trường hợp giỏ hàng trống
    if (cart.length === 0) {
        itemsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: #999;">
                <i class="fas fa-shopping-bag" style="font-size: 60px; margin-bottom: 20px; opacity: 0.2;"></i>
                <p style="font-size: 16px;">Giỏ hàng của bạn đang trống</p>
                <button onclick="toggleCart()" style="margin-top: 20px; padding: 12px 25px; border: 2px solid #f57224; background: transparent; color: #f57224; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s;">TIẾP TỤC MUA SẮM</button>
            </div>
        `;
        totalEl.innerText = '0 đ';
        return;
    }

    // Trường hợp có sản phẩm -> Vẽ danh sách
    let totalPrice = 0;
    itemsContainer.innerHTML = cart.map((item, index) => {
        const itemTotal = Number(item.price) * item.quantity;
        totalPrice += itemTotal;
        
        return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='/images/icon-logo.png'">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-variant">Phân loại: ${item.variant}</div>
                    <div class="cart-item-price">${Number(item.price).toLocaleString('vi-VN')} đ</div>
                    <div class="cart-item-qty">
                        <button onclick="changeCartQty(${index}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="changeCartQty(${index}, 1)">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeCartItem(${index})" title="Xóa sản phẩm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    // Cập nhật tổng tiền
    totalEl.innerText = Number(totalPrice).toLocaleString('vi-VN') + ' đ';
}

// 6. Tăng / Giảm số lượng
function changeCartQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1); // Xóa nếu giảm về 0
    }
    saveCart();
}

// 7. Nút thùng rác xóa sản phẩm
function removeCartItem(index) {
    cart.splice(index, 1);
    saveCart();
}

// 8. Tự động hiển thị số lượng giỏ hàng khi trang web vừa tải xong
document.addEventListener('DOMContentLoaded', updateCartUI);