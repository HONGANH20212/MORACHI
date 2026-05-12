// === HỆ THỐNG GIỎ HÀNG BẰNG LOCALSTORAGE ===

// 1. Khởi tạo giỏ hàng từ bộ nhớ trình duyệt
let cart = JSON.parse(localStorage.getItem('morachi_cart')) || [];

// 2. Lưu giỏ hàng
function saveCart() {
    localStorage.setItem('morachi_cart', JSON.stringify(cart));
    updateCartUI(); // Gọi hàm này để số lượng trên Header tự nhảy
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
    const existingItem = cart.find(item => item.id === product.id && item.variant === product.variant);
    
    if (existingItem) {
        existingItem.quantity += 1; 
    } else {
        cart.push({ ...product, quantity: 1 }); 
    }
    
    saveCart(); 
    // Giỏ hàng sẽ không tự động bật ra nữa, chỉ cộng số trên Header
}

// 5. Cập nhật giao diện giỏ hàng (Số lượng trên icon + Danh sách)
function updateCartUI() {
    // Cập nhật số lượng đếm trên Header
    const countElements = document.querySelectorAll('.cart-count');
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    countElements.forEach(el => el.innerText = totalQty);

    const itemsContainer = document.getElementById('cart-items');
    const totalEl = document.getElementById('cart-total-price');
    
    if (!itemsContainer || !totalEl) return;

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

    let totalPrice = 0;
    itemsContainer.innerHTML = cart.map((item, index) => {
        const itemTotal = Number(item.price) * item.quantity;
        totalPrice += itemTotal;
        
        return `
            <div class="cart-item" style="display: flex; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px dashed #eee; position: relative;">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='/images/icon-logo.png'" style="width: 80px; height: 80px; object-fit: contain; border: 1px solid #eee; border-radius: 8px; padding: 2px;">
                <div class="cart-item-info" style="flex: 1; padding-right: 25px;">
                    <div class="cart-item-title" style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #333; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${item.title}</div>
                    <div class="cart-item-variant" style="font-size: 12px; color: #888; margin-bottom: 5px;">Phân loại: ${item.variant}</div>
                    <div class="cart-item-price" style="color: #f57224; font-weight: bold; margin-bottom: 10px; font-size: 15px;">${Number(item.price).toLocaleString('vi-VN')} đ</div>
                    <div class="cart-item-qty" style="display: flex; align-items: center; border: 1px solid #ddd; width: fit-content; border-radius: 4px; overflow: hidden;">
                        <button onclick="changeCartQty(${index}, -1)" style="background: #f9f9f9; border: none; padding: 5px 12px; cursor: pointer; font-weight: bold; color: #555;">-</button>
                        <span style="padding: 0 12px; font-size: 13px; font-weight: bold; min-width: 30px; text-align: center;">${item.quantity}</span>
                        <button onclick="changeCartQty(${index}, 1)" style="background: #f9f9f9; border: none; padding: 5px 12px; cursor: pointer; font-weight: bold; color: #555;">+</button>
                    </div>
                </div>
                <button class="cart-item-remove" onclick="removeCartItem(${index})" title="Xóa sản phẩm" style="position: absolute; top: 0; right: 0; background: none; border: none; color: #ccc; cursor: pointer; font-size: 18px;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    totalEl.innerText = Number(totalPrice).toLocaleString('vi-VN') + ' đ';

    // Đánh tráo sự kiện của nút "Tiến hành thanh toán" để mở Form
    const checkoutBtn = document.querySelector('.cart-drawer .btn-checkout');
    if (checkoutBtn) {
        checkoutBtn.onclick = openCheckoutModal;
    }
}

function changeCartQty(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
    saveCart();
}

function removeCartItem(index) {
    cart.splice(index, 1);
    saveCart();
}

document.addEventListener('DOMContentLoaded', updateCartUI);


// ==============================================================
// 9. GIAO DIỆN & TÍNH NĂNG THANH TOÁN (CHECKOUT)
// ==============================================================

function openCheckoutModal() {
    if (cart.length === 0) {
        alert("Giỏ hàng của bạn đang trống!");
        return;
    }
    
    // Đóng giỏ hàng trượt tạm thời
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if(drawer) drawer.classList.remove('active');
    if(overlay) overlay.classList.remove('active');

    // Tạo modal thanh toán nếu chưa có
    let modal = document.getElementById('checkout-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checkout-modal';
        modal.className = 'checkout-modal';
        document.body.appendChild(modal);
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = 11000;
    const total = subtotal + shippingFee;

    // TẠO MÃ ĐƠN HÀNG DUY NHẤT (VD: DH-7B3F9A)
    const orderId = 'DH-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // THÔNG TIN NGÂN HÀNG CỦA BẠN (Sửa lại ở đây)
    const BANK_ID = "VCB"; // Mã ngân hàng: VCB, MB, TCB, CTG, ACB...
    const BANK_ACCOUNT = "1234567890"; // Số tài khoản của bạn
    const ACCOUNT_NAME = "NGUYEN VAN A"; // Tên chủ tài khoản (Viết không dấu)
    
    // TẠO LINK VIETQR (Bao gồm số tiền, tài khoản và nội dung CK)
    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.jpg?amount=${total}&addInfo=${orderId}&accountName=${ACCOUNT_NAME}`;

    modal.innerHTML = `
        <div class="checkout-box">
            <div class="checkout-header">
                <h2>Hoàn tất đơn hàng</h2>
                <button onclick="closeCheckoutModal()"><i class="fas fa-times"></i></button>
            </div>
            <div class="checkout-body">
                <div class="checkout-form">
                    <h3 style="margin-bottom: 10px; font-size: 15px; color: #111;">1. Thông tin giao hàng</h3>
                    <input type="text" id="chk-name" placeholder="Họ và tên người nhận" required>
                    <input type="tel" id="chk-phone" placeholder="Số điện thoại" required>
                    
                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <select id="chk-province" onchange="loadDistricts()"><option value="">Tỉnh/Thành phố</option></select>
                        <select id="chk-district" onchange="loadWards()"><option value="">Quận/Huyện</option></select>
                        <select id="chk-ward"><option value="">Phường/Xã</option></select>
                    </div>
                    <input type="text" id="chk-address" placeholder="Địa chỉ cụ thể (Số nhà, đường...)" required>

                    <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 15px; color: #111;">2. Phương thức thanh toán</h3>
                    <div class="payment-methods">
                        <label><input type="radio" name="chk-payment" value="cod" checked onchange="toggleBankInfo()"> Thanh toán tiền mặt (COD)</label>
                        <label><input type="radio" name="chk-payment" value="bank" onchange="toggleBankInfo()"> Chuyển khoản qua VietQR</label>
                    </div>

                    <!-- GIAO DIỆN QUÉT MÃ QR THANH TOÁN -->
                    <div id="bank-info-box" style="display: none; background: #e8f4fd; padding: 15px; border-radius: 6px; border: 1px dashed #3498db; margin-bottom: 15px; font-size: 13px; line-height: 1.6;">
                        <div style="color: #2980b9; font-weight: bold; margin-bottom: 15px; text-align: center; font-size: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
                            MÃ ĐƠN HÀNG CỦA BẠN: <span style="color:#e74c3c; font-size: 18px;">${orderId}</span>
                        </div>
                        
                        <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <strong>Ngân hàng:</strong> Vietcombank (VCB)<br>
                                <strong>Chủ tài khoản:</strong> ${ACCOUNT_NAME}<br>
                                <strong>Số tài khoản:</strong> ${BANK_ACCOUNT}<br>
                                <strong>Số tiền:</strong> <span style="color: #e74c3c; font-weight:bold; font-size:15px;">${total.toLocaleString('vi-VN')} đ</span><br>
                                <strong>Nội dung CK:</strong> <span style="color: #e74c3c; font-weight:bold; font-size:15px;">${orderId}</span><br>
                                <small style="color: #666; margin-top: 10px; display: block;">* Mở App Ngân hàng quét mã QR bên cạnh để điền tự động thông tin. Hệ thống sẽ xác nhận tự động sau 1-3 phút.</small>
                            </div>
                            <div style="text-align: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                <img src="${qrUrl}" alt="VietQR" style="width: 150px; height: 150px; border-radius: 4px;">
                                <div style="font-size: 11px; margin-top: 5px; color: #555; font-weight:bold;">Quét mã thanh toán</div>
                            </div>
                        </div>
                    </div>

                </div>
                <div class="checkout-summary">
                    <p>Tạm tính: <span>${subtotal.toLocaleString('vi-VN')} đ</span></p>
                    <p>Phí giao hàng: <span>11.000 đ</span></p>
                    <p style="font-size: 11px; color: #e74c3c; margin-top: -3px; margin-bottom: 10px; font-style: italic;">* Ưu đãi phí ship đồng giá 11k áp dụng hết tháng 5</p>
                    <h3 style="border-top: 1px dashed #f57224; padding-top: 15px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 18px;">
                        Tổng thanh toán: <span style="color: #f57224;">${total.toLocaleString('vi-VN')} đ</span>
                    </h3>
                </div>
            </div>
            <div class="checkout-footer">
                <button class="btn-checkout-confirm" onclick="submitOrder('${orderId}')">HOÀN TẤT ĐẶT HÀNG</button>
            </div>
        </div>
    `;

    modal.classList.add('active');
    fetchProvinces(); // Gọi API để tải danh sách tỉnh thành Việt Nam
}

window.closeCheckoutModal = function() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
}

window.toggleBankInfo = function() {
    const method = document.querySelector('input[name="chk-payment"]:checked').value;
    const box = document.getElementById('bank-info-box');
    box.style.display = method === 'bank' ? 'block' : 'none';
}

// ==========================================
// TÍCH HỢP API DANH SÁCH ĐỊA CHỈ VIỆT NAM
// ==========================================
let vnProvinces = [];

async function fetchProvinces() {
    try {
        const res = await fetch('https://provinces.open-api.vn/api/?depth=3');
        vnProvinces = await res.json();
        const pSelect = document.getElementById('chk-province');
        if(pSelect && pSelect.options.length === 1) { // Chỉ load 1 lần tránh lặp
            vnProvinces.forEach(p => {
                let opt = document.createElement('option');
                opt.value = p.code;
                opt.text = p.name;
                pSelect.add(opt);
            });
        }
    } catch (e) {
        console.error("Lỗi API địa chỉ:", e);
    }
}

window.loadDistricts = function() {
    const pCode = document.getElementById('chk-province').value;
    const dSelect = document.getElementById('chk-district');
    const wSelect = document.getElementById('chk-ward');
    
    dSelect.innerHTML = '<option value="">Quận/Huyện</option>';
    wSelect.innerHTML = '<option value="">Phường/Xã</option>';
    
    if(!pCode) return;
    const p = vnProvinces.find(x => x.code == pCode);
    if(p && p.districts) {
        p.districts.forEach(d => {
            let opt = document.createElement('option');
            opt.value = d.code;
            opt.text = d.name;
            dSelect.add(opt);
        });
    }
}

window.loadWards = function() {
    const pCode = document.getElementById('chk-province').value;
    const dCode = document.getElementById('chk-district').value;
    const wSelect = document.getElementById('chk-ward');
    
    wSelect.innerHTML = '<option value="">Phường/Xã</option>';
    
    if(!pCode || !dCode) return;
    const p = vnProvinces.find(x => x.code == pCode);
    const d = p.districts.find(x => x.code == dCode);
    if(d && d.wards) {
        d.wards.forEach(w => {
            let opt = document.createElement('option');
            opt.value = w.code;
            opt.text = w.name;
            wSelect.add(opt);
        });
    }
}

// XỬ LÝ ĐẶT HÀNG VÀ TẠO DATA
window.submitOrder = function(orderId) {
    const name = document.getElementById('chk-name').value.trim();
    const phone = document.getElementById('chk-phone').value.trim();
    const address = document.getElementById('chk-address').value.trim();
    const prov = document.getElementById('chk-province').options[document.getElementById('chk-province').selectedIndex].text;
    const dist = document.getElementById('chk-district').options[document.getElementById('chk-district').selectedIndex].text;
    const ward = document.getElementById('chk-ward').options[document.getElementById('chk-ward').selectedIndex].text;

    if (!document.getElementById('chk-name').value.trim() || !phone || !address || document.getElementById('chk-province').value === "") {
        alert("Vui lòng điền đầy đủ Thông tin giao hàng!");
        return;
    }

    const method = document.querySelector('input[name="chk-payment"]:checked').value;
    
    // Thu thập dữ liệu để gửi lên backend sau này
    const orderData = {
        order_id: orderId,
        customer_info: { name, phone, address: `${address}, ${ward}, ${dist}, ${prov}` },
        items: cart,
        total_amount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 11000,
        payment_method: method,
        status: method === 'bank' ? 'pending_payment' : 'pending_cod',
        created_at: new Date().toISOString()
    };

    console.log("Đã tạo đơn hàng:", orderData);
    // (Ở giai đoạn tiếp theo, ta sẽ gọi lệnh fetch() để gửi orderData này vào Python API)

    if (method === 'bank') {
        alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nVui lòng đảm bảo bạn đã quét mã QR để chuyển khoản. Chúng tôi sẽ xác nhận đơn hàng khi nhận được thanh toán.`);
    } else {
        alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nChúng tôi sẽ đóng gói và thu tiền mặt (COD) tận nhà cho bạn.`);
    }

    // Xóa giỏ hàng sau khi đặt thành công
    cart = [];
    saveCart();
    closeCheckoutModal();
}

// ==========================================
// TỰ ĐỘNG BƠM CSS CHO GIAO DIỆN THANH TOÁN
// ==========================================
const checkoutStyle = document.createElement('style');
checkoutStyle.innerHTML = `
    .checkout-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; justify-content: center; align-items: center; visibility: hidden; opacity: 0; transition: 0.3s; }
    .checkout-modal.active { visibility: visible; opacity: 1; }
    .checkout-box { background: #fff; width: 90%; max-width: 600px; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); transform: translateY(-20px); transition: 0.3s; display:flex; flex-direction: column; max-height: 90vh;}
    .checkout-modal.active .checkout-box { transform: translateY(0); }
    .checkout-header { background: #111; color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; }
    .checkout-header h2 { margin: 0; font-size: 16px; text-transform: uppercase;}
    .checkout-header button { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
    .checkout-body { padding: 20px; overflow-y: auto; }
    .checkout-form input[type="text"], .checkout-form input[type="tel"], .checkout-form select { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 14px;}
    .checkout-form input:focus, .checkout-form select:focus { outline: none; border-color: #f57224; }
    .payment-methods label { display: flex; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 10px; cursor: pointer; background: #fafafa; font-size: 14px;}
    .payment-methods input { width: auto; margin-right: 10px; transform: scale(1.2); accent-color: #f57224;}
    .checkout-summary { background: #fff5f0; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px dashed #f57224;}
    .checkout-summary p { display: flex; justify-content: space-between; margin: 5px 0; color: #555; font-size: 14px;}
    .checkout-footer { padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; }
    .btn-checkout-confirm { width: 100%; padding: 15px; background: #f57224; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
    .btn-checkout-confirm:hover { background: #d35400; }
`;
document.head.appendChild(checkoutStyle);