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

    // THÔNG TIN NGÂN HÀNG CỦA BẠN
    const BANK_ID = "VCB"; 
    const BANK_ACCOUNT = "1234567890"; 
    const ACCOUNT_NAME = "NGUYEN VAN A"; 
    
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
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px;">
                        <select id="chk-province" class="searchable-select"><option value="">Tỉnh/Thành phố</option></select>
                        <select id="chk-district" class="searchable-select"><option value="">Quận/Huyện</option></select>
                        <select id="chk-ward" class="searchable-select"><option value="">Phường/Xã</option></select>
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
// TÍCH HỢP TÌM KIẾM ĐỊA CHỈ (SELECT2 LIBRARIES)
// ==========================================
let vnProvinces = [];

async function fetchProvinces() {
    try {
        const res = await fetch('https://provinces.open-api.vn/api/?depth=3');
        vnProvinces = await res.json();
        const pSelect = document.getElementById('chk-province');
        if(pSelect && pSelect.options.length <= 1) { 
            vnProvinces.forEach(p => {
                let opt = document.createElement('option');
                opt.value = p.code;
                opt.text = p.name;
                pSelect.add(opt);
            });
        }
        
        // Chèn thư viện jQuery và Select2 để tạo thanh Tìm kiếm cho Địa chỉ
        initSelect2();
        
    } catch (e) {
        console.error("Lỗi API địa chỉ:", e);
    }
}

// Hàm nhúng thư viện tìm kiếm ô chọn (Select2)
function initSelect2() {
    if (typeof jQuery === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js";
        script.onload = loadS2Script;
        document.head.appendChild(script);
    } else {
        loadS2Script();
    }
}

function loadS2Script() {
    if (typeof jQuery.fn.select2 === 'undefined') {
        const css = document.createElement('link');
        css.rel = "stylesheet";
        css.href = "https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css";
        document.head.appendChild(css);

        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js";
        script.onload = applySelect2;
        document.head.appendChild(script);
    } else {
        applySelect2();
    }
}

function applySelect2() {
    // Áp dụng khung tìm kiếm vào 3 ô địa chỉ
    $('#chk-province').select2({ dropdownParent: $('#checkout-modal'), width: '100%', placeholder: 'Tỉnh/Thành phố' });
    $('#chk-district').select2({ dropdownParent: $('#checkout-modal'), width: '100%', placeholder: 'Quận/Huyện' });
    $('#chk-ward').select2({ dropdownParent: $('#checkout-modal'), width: '100%', placeholder: 'Phường/Xã' });

    // Gán sự kiện khi chọn xong sẽ tải các Huyện/Xã tương ứng
    $('#chk-province').on('change', window.loadDistricts);
    $('#chk-district').on('change', window.loadWards);
}

window.loadDistricts = function() {
    if (typeof jQuery === 'undefined') return;
    const pCode = $('#chk-province').val();
    const dSelect = $('#chk-district');
    const wSelect = $('#chk-ward');
    
    dSelect.empty().append('<option value="">Quận/Huyện</option>');
    wSelect.empty().append('<option value="">Phường/Xã</option>');
    
    if(!pCode) {
        dSelect.trigger('change');
        wSelect.trigger('change');
        return;
    }
    
    const p = vnProvinces.find(x => x.code == pCode);
    if(p && p.districts) {
        p.districts.forEach(d => {
            dSelect.append(new Option(d.name, d.code));
        });
    }
    dSelect.trigger('change');
    wSelect.trigger('change');
}

window.loadWards = function() {
    if (typeof jQuery === 'undefined') return;
    const pCode = $('#chk-province').val();
    const dCode = $('#chk-district').val();
    const wSelect = $('#chk-ward');
    
    wSelect.empty().append('<option value="">Phường/Xã</option>');
    
    if(!pCode || !dCode) {
        wSelect.trigger('change');
        return;
    }
    
    const p = vnProvinces.find(x => x.code == pCode);
    const d = p.districts.find(x => x.code == dCode);
    if(d && d.wards) {
        d.wards.forEach(w => {
            wSelect.append(new Option(w.name, w.code));
        });
    }
    wSelect.trigger('change');
}

// XỬ LÝ ĐẶT HÀNG VÀ BẮN API VÀO DATABASE (PYTHON)
window.submitOrder = async function(tempOrderId) {
    const btn = document.querySelector('.btn-checkout-confirm');
    btn.innerText = "Đang xử lý...";
    btn.disabled = true;

    const name = document.getElementById('chk-name').value.trim();
    const phone = document.getElementById('chk-phone').value.trim();
    const address = document.getElementById('chk-address').value.trim();
    
    const provEl = document.getElementById('chk-province');
    const distEl = document.getElementById('chk-district');
    const wardEl = document.getElementById('chk-ward');
    
    const prov = provEl.options[provEl.selectedIndex] ? provEl.options[provEl.selectedIndex].text : '';
    const dist = distEl.options[distEl.selectedIndex] ? distEl.options[distEl.selectedIndex].text : '';
    const ward = wardEl.options[wardEl.selectedIndex] ? wardEl.options[wardEl.selectedIndex].text : '';

    if (!name || !phone || !address || !document.getElementById('chk-province').value) {
        alert("Vui lòng điền đầy đủ Thông tin giao hàng!");
        btn.innerText = "HOÀN TẤT ĐẶT HÀNG";
        btn.disabled = false;
        return;
    }

    // Lấy số thứ tự đơn hàng (MO0001, MO0002...)
    let orderCount = parseInt(localStorage.getItem('morachi_order_count') || '0');
    orderCount++;
    localStorage.setItem('morachi_order_count', orderCount);
    const orderId = 'MO' + String(orderCount).padStart(4, '0');

    const method = document.querySelector('input[name="chk-payment"]:checked').value;
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 11000;
    
    const orderData = {
        order_id: orderId,
        customer_info: { name, phone, address, prov, dist, ward }, 
        items: cart,
        total_amount: totalAmount,
        payment_method: method,
        status: method === 'bank' ? 'Chờ chuyển khoản' : 'Chờ xác nhận COD'
    };

    // GỌI API PYTHON ĐỂ LƯU ĐƠN HÀNG VÀO DATABASE
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error("API lỗi");

        if (method === 'bank') {
            alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nVui lòng đảm bảo bạn đã quét mã QR để chuyển khoản. Hệ thống Admin đã ghi nhận đơn hàng.`);
        } else {
            alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nChúng tôi sẽ đóng gói và thu tiền mặt (COD) tận nhà cho bạn.`);
        }

        cart = [];
        saveCart();
        closeCheckoutModal();

    } catch (error) {
        console.error("Lỗi:", error);
        alert("Máy chủ đang bận, không thể lưu đơn hàng. Vui lòng thử lại!");
    } finally {
        btn.innerText = "HOÀN TẤT ĐẶT HÀNG";
        btn.disabled = false;
    }
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
    
    .checkout-form input[type="text"], .checkout-form input[type="tel"], .checkout-form select { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 14px; outline: none;}
    .checkout-form input:focus { border-color: #f57224; }
    
    /* Ghi đè giao diện thư viện Select2 để khớp với khung nhập */
    .select2-container--default .select2-selection--single { height: 43px; border: 1px solid #ddd; border-radius: 6px; outline: none; }
    .select2-container--default .select2-selection--single .select2-selection__rendered { line-height: 43px; padding-left: 12px; color: #333; font-size: 14px;}
    .select2-container--default .select2-selection--single .select2-selection__arrow { height: 40px; }
    .select2-dropdown { border-color: #f57224; border-radius: 6px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
    .select2-container--default .select2-results__option--highlighted[aria-selected], .select2-container--default .select2-results__option--highlighted.select2-results__option--selectable { background-color: #f57224 !important; color: white !important;}
    .select2-container--default .select2-search--dropdown .select2-search__field { border-radius: 4px; padding: 6px 10px; border: 1px solid #ddd; outline: none;}
    .select2-container--default .select2-search--dropdown .select2-search__field:focus { border-color: #f57224; }
    .select2-container--default .select2-selection--single:focus { border-color: #f57224; }

    .payment-methods label { display: flex; align-items: center; padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin-bottom: 10px; cursor: pointer; background: #fafafa; font-size: 14px;}
    .payment-methods input { width: auto; margin-right: 10px; transform: scale(1.2); accent-color: #f57224;}
    .checkout-summary { background: #fff5f0; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px dashed #f57224;}
    .checkout-summary p { display: flex; justify-content: space-between; margin: 5px 0; color: #555; font-size: 14px;}
    .checkout-footer { padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; }
    .btn-checkout-confirm { width: 100%; padding: 15px; background: #f57224; color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
    .btn-checkout-confirm:hover { background: #d35400; }
`;
document.head.appendChild(checkoutStyle);