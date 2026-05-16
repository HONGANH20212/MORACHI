// === HỆ THỐNG GIỎ HÀNG BẰNG LOCALSTORAGE ===

// 1. Khởi tạo giỏ hàng từ bộ nhớ trình duyệt
let cart = JSON.parse(localStorage.getItem('morachi_cart')) || [];
let currentCheckoutOrderId = ""; 

// 2. Lưu giỏ hàng
function saveCart() {
    localStorage.setItem('morachi_cart', JSON.stringify(cart));
    updateCartUI(); 
}

// 3. Mở giỏ hàng (Luôn trượt ra)
function openCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer && overlay) {
        drawer.classList.add('active');
        overlay.classList.add('active');
        updateCartUI();
    }
}

// 3.1 Mở / Đóng giao diện giỏ hàng linh hoạt (Toggle)
function toggleCart() {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    
    if (drawer && overlay) {
        drawer.classList.toggle('active');
        overlay.classList.toggle('active');
        updateCartUI();
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
    // Đã xóa lệnh tự trượt giỏ hàng ra ở đây!
}

// 5. Cập nhật giao diện giỏ hàng
function updateCartUI() {
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
                <img src="${item.image}" alt="${item.title}" onerror="this.src='images/icon-logo.png'" style="width: 80px; height: 80px; object-fit: contain; border: 1px solid #eee; border-radius: 8px; padding: 2px;">
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

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = 11000;
    const total = subtotal + shippingFee;

    const nextOrderCount = parseInt(localStorage.getItem('morachi_order_count') || '0') + 1;
    currentCheckoutOrderId = 'MO' + String(nextOrderCount).padStart(4, '0');

    // THÔNG TIN NGÂN HÀNG
    const BANK_ID = "VCB"; 
    const BANK_ACCOUNT = "1234567890"; 
    const ACCOUNT_NAME = "NGUYEN VAN A"; 
    
    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.jpg?amount=${total}&addInfo=${currentCheckoutOrderId}&accountName=${ACCOUNT_NAME}`;

    let modal = document.getElementById('checkout-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checkout-modal';
        modal.className = 'checkout-modal';
        document.body.appendChild(modal);

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
                        
                        <div style="position: relative;">
                            <input type="text" id="chk-address" placeholder="Địa chỉ cụ thể (Số nhà, đường...)" required autocomplete="off">
                            <div id="address-suggestions" style="position: absolute; background: white; border: 1px solid #ddd; width: 100%; max-height: 220px; overflow-y: auto; z-index: 1000; display: none; box-shadow: 0 10px 20px rgba(0,0,0,0.15); border-radius: 6px; top: calc(100% - 10px); left: 0;"></div>
                        </div>

                        <h3 style="margin-top: 25px; margin-bottom: 10px; font-size: 15px; color: #111;">2. Phương thức thanh toán</h3>
                        <div class="payment-methods">
                            <label><input type="radio" name="chk-payment" value="cod" checked onchange="toggleBankInfo()"> Thanh toán tiền mặt (COD)</label>
                            <label><input type="radio" name="chk-payment" value="bank" onchange="toggleBankInfo()"> Chuyển khoản qua VietQR</label>
                        </div>

                        <div id="bank-info-box" style="display: none; background: #e8f4fd; padding: 15px; border-radius: 6px; border: 1px dashed #3498db; margin-bottom: 15px; font-size: 13px; line-height: 1.6;">
                            <div style="color: #2980b9; font-weight: bold; margin-bottom: 15px; text-align: center; font-size: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
                                MÃ ĐƠN HÀNG CỦA BẠN: <span id="chk-order-id" style="color:#e74c3c; font-size: 18px;">${currentCheckoutOrderId}</span>
                            </div>
                            
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 200px;">
                                    <strong>Ngân hàng:</strong> Vietcombank (VCB)<br>
                                    <strong>Chủ tài khoản:</strong> ${ACCOUNT_NAME}<br>
                                    <strong>Số tài khoản:</strong> ${BANK_ACCOUNT}<br>
                                    <strong>Số tiền:</strong> <span id="chk-qr-amount" style="color: #e74c3c; font-weight:bold; font-size:15px;">${total.toLocaleString('vi-VN')} đ</span><br>
                                    <strong>Nội dung CK:</strong> <span id="chk-qr-content" style="color: #e74c3c; font-weight:bold; font-size:15px;">${currentCheckoutOrderId}</span><br>
                                    <small style="color: #666; margin-top: 10px; display: block;">* Mở App Ngân hàng quét mã QR bên cạnh để điền tự động thông tin. Hệ thống sẽ xác nhận tự động sau 1-3 phút.</small>
                                </div>
                                <div style="text-align: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                    <img id="chk-qr-img" src="${qrUrl}" alt="VietQR" style="width: 150px; height: 150px; border-radius: 4px;">
                                    <div style="font-size: 11px; margin-top: 5px; color: #555; font-weight:bold;">Quét mã thanh toán</div>
                                </div>
                            </div>
                        </div>

                    </div>
                    <div class="checkout-summary">
                        <p>Tạm tính: <span id="chk-subtotal">${subtotal.toLocaleString('vi-VN')} đ</span></p>
                        <p>Phí giao hàng: <span>11.000 đ</span></p>
                        <p style="font-size: 11px; color: #e74c3c; margin-top: -3px; margin-bottom: 10px; font-style: italic;">* Ưu đãi phí ship đồng giá 11k áp dụng hết tháng 5</p>
                        <h3 style="border-top: 1px dashed #f57224; padding-top: 15px; margin-top: 10px; display: flex; justify-content: space-between; font-size: 18px;">
                            Tổng thanh toán: <span id="chk-total" style="color: #f57224;">${total.toLocaleString('vi-VN')} đ</span>
                        </h3>
                    </div>
                </div>
                <div class="checkout-footer">
                    <button class="btn-checkout-confirm" onclick="submitOrder()">HOÀN TẤT ĐẶT HÀNG</button>
                </div>
            </div>
        `;
        
        fetchProvinces(); 
        setupAddressAutocomplete(); 
    } else {
        document.getElementById('chk-subtotal').innerText = subtotal.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-total').innerText = total.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-order-id').innerText = currentCheckoutOrderId;
        document.getElementById('chk-qr-amount').innerText = total.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-qr-content').innerText = currentCheckoutOrderId;
        document.getElementById('chk-qr-img').src = qrUrl;
    }

    modal.classList.add('active');
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

(function preloadLibraries() {
    if (typeof jQuery === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js";
        script.onload = () => {
            const css = document.createElement('link');
            css.rel = "stylesheet";
            css.href = "https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css";
            document.head.appendChild(css);

            const s2Script = document.createElement('script');
            s2Script.src = "https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js";
            s2Script.onload = () => {
                applySelect2();
            };
            document.head.appendChild(s2Script);
        };
        document.head.appendChild(script);
    }
})();

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
        applySelect2();
    } catch (e) { console.error("Lỗi API địa chỉ:", e); }
}

function applySelect2() {
    if (typeof jQuery === 'undefined' || typeof jQuery.fn.select2 === 'undefined') {
        setTimeout(applySelect2, 300);
        return;
    }

    $('#chk-province').select2({ width: '100%', placeholder: 'Tỉnh/Thành phố' });
    $('#chk-district').select2({ width: '100%', placeholder: 'Quận/Huyện' });
    $('#chk-ward').select2({ width: '100%', placeholder: 'Phường/Xã' });

    $('#chk-province').off('change').on('change', window.loadDistricts);
    $('#chk-district').off('change').on('change', window.loadWards);

    $(document).on('select2:open', () => {
        setTimeout(() => {
            const searchField = document.querySelector('.select2-search__field');
            if (searchField) searchField.focus();
        }, 50);
    });
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

// ==========================================
// TÍNH NĂNG GỢI Ý ĐỊA CHỈ (AUTOCOMPLETE) 
// ==========================================
let searchTimeout;
window.setupAddressAutocomplete = function() {
    const addressInput = document.getElementById('chk-address');
    const dropdown = document.getElementById('address-suggestions');
    if (!addressInput || !dropdown) return;

    addressInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 3) {
            dropdown.style.display = 'none';
            return;
        }

        const provEl = document.getElementById('chk-province');
        const distEl = document.getElementById('chk-district');
        let context = "";
        if(distEl && distEl.options[distEl.selectedIndex]?.value) context += ", " + distEl.options[distEl.selectedIndex].text;
        if(provEl && provEl.options[provEl.selectedIndex]?.value) context += ", " + provEl.options[provEl.selectedIndex].text;

        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + context)}&countrycodes=vn&format=json&limit=5`);
                const data = await res.json();
                
                if (data && data.length > 0) {
                    dropdown.innerHTML = data.map((item, index) => `
                        <div class="suggestion-item" data-index="${index}" style="padding: 12px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; font-size: 13px; color: #333; line-height: 1.5; transition: 0.2s;">
                            <i class="fas fa-map-marker-alt" style="color:#f57224; margin-right:8px;"></i> ${item.display_name}
                        </div>
                    `).join('');
                    dropdown.style.display = 'block';

                    dropdown.querySelectorAll('.suggestion-item').forEach(el => {
                        el.addEventListener('click', function() {
                            const idx = this.getAttribute('data-index');
                            const selectedData = data[idx];
                            const parts = selectedData.display_name.split(',');
                            addressInput.value = (parts[0] + (parts[1] ? ', ' + parts[1].trim() : '')).trim();
                            dropdown.style.display = 'none';
                        });
                        el.addEventListener('mouseover', () => el.style.background = '#fff5f0');
                        el.addEventListener('mouseout', () => el.style.background = 'white');
                    });
                } else {
                    dropdown.style.display = 'none';
                }
            } catch (e) {
                console.error("Lỗi gợi ý địa chỉ:", e);
            }
        }, 500); 
    });

    document.addEventListener('click', function(e) {
        if (e.target !== addressInput && e.target !== dropdown) {
            dropdown.style.display = 'none';
        }
    });
}

// XỬ LÝ ĐẶT HÀNG VÀ BẮN API VÀO DATABASE
window.submitOrder = async function() {
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

    const orderId = currentCheckoutOrderId;
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

    let allOrders = JSON.parse(localStorage.getItem('morachi_orders') || '[]');
    allOrders.unshift(orderData);
    localStorage.setItem('morachi_orders', JSON.stringify(allOrders));

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error("API lỗi");

    } catch (error) {
        console.error("Lỗi:", error);
    } finally {
        let orderCount = parseInt(localStorage.getItem('morachi_order_count') || '0');
        orderCount++;
        localStorage.setItem('morachi_order_count', orderCount);

        if (method === 'bank') {
            alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nVui lòng đảm bảo bạn đã quét mã QR để chuyển khoản. Hệ thống Admin đã ghi nhận đơn hàng.`);
        } else {
            alert(`Cảm ơn ${name} đã đặt hàng!\n\nMã đơn hàng của bạn là: ${orderId}\n\nChúng tôi sẽ đóng gói và thu tiền mặt (COD) tận nhà cho bạn.`);
        }

        cart = [];
        saveCart();
        closeCheckoutModal();
        
        btn.innerText = "HOÀN TẤT ĐẶT HÀNG";
        btn.disabled = false;
    }
}

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
    
    .select2-container--default .select2-selection--single { height: 43px; border: 1px solid #ddd; border-radius: 6px; outline: none; }
    .select2-container--default .select2-selection--single .select2-selection__rendered { line-height: 43px; padding-left: 12px; color: #333; font-size: 14px;}
    .select2-container--default .select2-selection--single .select2-selection__arrow { height: 40px; }
    
    .select2-container--open { z-index: 999999 !important; }
    .select2-dropdown { border-color: #f57224; border-radius: 6px; overflow: hidden; box-shadow: 0 5px 15px rgba(0,0,0,0.1); z-index: 999999 !important; }
    
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

    /* Scrollbar cho ô Gợi ý địa chỉ */
    #address-suggestions::-webkit-scrollbar { width: 6px; }
    #address-suggestions::-webkit-scrollbar-track { background: #f1f1f1; }
    #address-suggestions::-webkit-scrollbar-thumb { background: #ccc; border-radius: 4px; }
`;
document.head.appendChild(checkoutStyle);

// ==============================================================
// 10. TÍNH NĂNG NÚT LIÊN HỆ NỔI (FLOATING CONTACT) TỰ ĐỘNG
// ==============================================================
function initFloatingContact() {
    if (document.querySelector('.floating-contact')) return;

    const style = document.createElement('style');
    style.innerHTML = `
        .floating-contact { position: fixed; bottom: 30px; right: 30px; display: flex; flex-direction: column; gap: 15px; z-index: 9999; }
        .float-btn { width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; text-decoration: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative; }
        .float-btn:hover { transform: translateY(-5px) scale(1.05); color: white; box-shadow: 0 6px 15px rgba(0,0,0,0.4); }
        .float-btn .tooltip { position: absolute; right: 55px; background: rgba(0,0,0,0.8); color: white; padding: 5px 12px; border-radius: 6px; font-size: 13px; white-space: nowrap; opacity: 0; visibility: hidden; transition: 0.3s ease; pointer-events: none; font-weight: bold; }
        .float-btn:hover .tooltip { opacity: 1; visibility: visible; right: 60px; }
        .btn-messenger { background: linear-gradient(45deg, #00C6FF, #0072FF); animation: pulse-ring 2s infinite; }
        .btn-facebook { background: #1877F2; }
        .btn-tiktok1 { background: #000000; border: 2px solid #fff; }
        .btn-tiktok2 { background: #000000; border: 2px solid #00f2fe; }

        @keyframes pulse-ring {
            0% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(0, 132, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 132, 255, 0); }
        }

        @media (max-width: 768px) {
            .floating-contact { bottom: 20px; right: 15px; transform: scale(0.9); transform-origin: bottom right; }
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'floating-contact';
    container.innerHTML = `
        <a href="https://www.facebook.com/profile.php?id=61572066442519" target="_blank" class="float-btn btn-messenger">
            <i class="fab fa-facebook-messenger"></i>
            <span class="tooltip">Chat Messenger</span>
        </a>
        <a href="https://www.facebook.com/profile.php?id=61572066442519" target="_blank" class="float-btn btn-facebook">
            <i class="fab fa-facebook-f"></i>
            <span class="tooltip">Facebook Fanpage</span>
        </a>
        <a href="https://www.tiktok.com/@donhatnoidia2026" target="_blank" class="float-btn btn-tiktok1">
            <i class="fab fa-tiktok"></i>
            <span class="tooltip">Tiệm đồ nhật nội địa</span>
        </a>
        <a href="https://www.tiktok.com/@morachijanpan" target="_blank" class="float-btn btn-tiktok2">
            <i class="fab fa-tiktok"></i>
            <span class="tooltip">Morachi</span>
        </a>
    `;
    document.body.appendChild(container);
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartUI();
    initFloatingContact(); 
});