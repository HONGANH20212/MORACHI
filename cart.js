// === HỆ THỐNG GIỎ HÀNG BẰNG LOCALSTORAGE ===

// 1. Khởi tạo giỏ hàng từ bộ nhớ trình duyệt
// (Bọc trong try/catch: nếu dữ liệu localStorage bị lỗi/hỏng, JSON.parse sẽ
// ném lỗi và làm dừng toàn bộ phần code phía dưới của file này -> khiến các
// hàm như setupAddressAutocomplete, toggleBankInfo, submitOrder... không
// bao giờ được định nghĩa, dẫn đến popup thanh toán không hiện ra được)
let cart = [];
try {
    cart = JSON.parse(localStorage.getItem('morachi_cart')) || [];
    if (!Array.isArray(cart)) cart = [];
} catch (e) {
    console.error('Dữ liệu giỏ hàng (morachi_cart) bị lỗi, đã reset về giỏ hàng trống:', e);
    cart = [];
    try { localStorage.removeItem('morachi_cart'); } catch (e2) {}
}
let currentCheckoutOrderId = ""; 
let vnProvinces = []; // Biến chứa dữ liệu địa chỉ toàn cục

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
    
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if(drawer) drawer.classList.remove('active');
    if(overlay) overlay.classList.remove('active');

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingFee = 15000;
    const total = subtotal + shippingFee;

    const timestamp = new Date().getTime().toString();
    const randomNum = Math.floor(10 + Math.random() * 90);
    currentCheckoutOrderId = 'MO' + timestamp.slice(-4) + randomNum;
    
    // THÔNG TIN NGÂN HÀNG
    const BANK_ID = "MB"; 
    const BANK_ACCOUNT = "2470168848012"; 
    const ACCOUNT_NAME = "VO THI HONG ANH"; 
    
    const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.jpg?amount=${total}&addInfo=${encodeURIComponent(currentCheckoutOrderId)}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

    let modal = document.getElementById('checkout-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checkout-modal';
        modal.className = 'checkout-modal';
        document.body.appendChild(modal);

        const cartItemsHtml = cart.map(item => `
            <div class="chk-item-row">
                <img src="${item.image}" alt="${item.title}" onerror="this.src='images/icon-logo.png'">
                <div class="chk-item-info">
                    <div class="chk-item-title">${item.title}</div>
                    <div class="chk-item-variant">Màu/Phân loại: ${item.variant}</div>
                    <div class="chk-item-qty-label">SL: ${item.quantity}</div>
                </div>
                <div class="chk-item-price">
                    <div class="price">${Number(item.price).toLocaleString('vi-VN')} đ</div>
                    <div class="qty">x ${item.quantity}</div>
                </div>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="checkout-box new-checkout-layout">
                <div class="chk-header-gradient">
                    <div class="chk-hdr-left">
                        <div class="chk-bag-icon"><i class="fas fa-shopping-bag"></i></div>
                        <div>
                            <h2>HOÀN TẤT ĐƠN HÀNG</h2>
                            <p>Vui lòng kiểm tra thông tin và xác nhận đặt hàng</p>
                        </div>
                    </div>
                    <div class="chk-hdr-right">
                        <div class="chk-action-btn" title="Chia sẻ"><i class="fas fa-share-alt"></i><span>Chia sẻ</span></div>
                        <div class="chk-action-btn" title="Lưu đơn"><i class="fas fa-file-invoice"></i><span>Lưu đơn</span></div>
                        <div class="chk-action-btn" title="Tải xuống"><i class="fas fa-download"></i><span>Tải xuống</span></div>
                        <button class="close-modal-btn" onclick="closeCheckoutModal()"><i class="fas fa-times"></i></button>
                    </div>
                </div>

                <div class="chk-body-wrapper">
                    <div class="chk-col-left">
                        <div class="chk-card-section">
                            <div class="chk-sec-title">
                                <div class="step-circle">1</div>
                                <div>
                                    <h3>THÔNG TIN GIAO HÀNG</h3>
                                    <p>Nhập thông tin người nhận và địa chỉ giao hàng</p>
                                </div>
                            </div>
                            
                            <div class="chk-form-area">
                                <div class="chk-input-group">
                                    <i class="fas fa-user"></i>
                                    <input type="text" id="chk-name" placeholder="Họ và tên người nhận" required>
                                </div>
                                <div class="chk-input-group">
                                    <i class="fas fa-phone-alt"></i>
                                    <input type="tel" id="chk-phone" placeholder="Số điện thoại" required>
                                </div>
                                
                                <div class="chk-select-row">
                                    <div class="chk-input-group chk-select-wrap">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <select id="chk-province" style="width: 100%;"><option value="">Tỉnh/Thành phố</option></select>
                                    </div>
                                    <div class="chk-input-group chk-select-wrap">
                                        <i class="fas fa-building"></i>
                                        <select id="chk-district" style="width: 100%;"><option value="">Quận/Huyện</option></select>
                                    </div>
                                    <div class="chk-input-group chk-select-wrap">
                                        <i class="fas fa-home"></i>
                                        <select id="chk-ward" style="width: 100%;"><option value="">Phường/Xã</option></select>
                                    </div>
                                </div>
                                
                                <div class="chk-input-group" style="position: relative;">
                                    <i class="fas fa-map"></i>
                                    <input type="text" id="chk-address" placeholder="Địa chỉ cụ thể (Số nhà, đường, tòa nhà...)" required autocomplete="off">
                                    <div id="address-suggestions" style="position: absolute; background: white; border: 1px solid #ddd; width: 100%; max-height: 220px; overflow-y: auto; z-index: 1000; display: none; box-shadow: 0 10px 20px rgba(0,0,0,0.15); border-radius: 6px; top: calc(100% - 2px); left: 0;"></div>
                                </div>
                            </div>

                            <div class="chk-alert-box alert-orange">
                                <i class="fas fa-shield-alt"></i>
                                <div>
                                    <strong>Thông tin của bạn được bảo mật</strong>
                                    <span>Chúng tôi cam kết bảo vệ thông tin cá nhân của bạn</span>
                                </div>
                            </div>
                        </div>

                        <div class="chk-card-section" style="margin-top: 20px;">
                            <div class="chk-sec-title">
                                <div class="step-circle">2</div>
                                <div>
                                    <h3>PHƯƠNG THỨC THANH TOÁN</h3>
                                    <p>Chọn phương thức thanh toán phù hợp</p>
                                </div>
                            </div>
                            
                            <div class="chk-payment-options">
                                <label class="payment-card">
                                    <i class="fas fa-money-bill-wave" style="color: #2ecc71;"></i>
                                    <div class="pay-info">
                                        <strong>Thanh toán khi nhận hàng (COD)</strong>
                                        <span>Thanh toán bằng tiền mặt khi nhận hàng</span>
                                    </div>
                                    <input type="radio" name="chk-payment" value="cod" checked onchange="toggleBankInfo()">
                                    <span class="custom-radio"></span>
                                </label>
                                
                                <label class="payment-card">
                                    <i class="fas fa-university" style="color: #3498db;"></i>
                                    <div class="pay-info">
                                        <strong>Chuyển khoản qua VietQR</strong>
                                        <span>Mã QR tự động điền số tiền & nội dung đơn hàng</span>
                                    </div>
                                    <input type="radio" name="chk-payment" value="bank" onchange="toggleBankInfo()">
                                    <span class="custom-radio"></span>
                                </label>
                            </div>

                            <div id="bank-info-box" style="display: none; background: #fafafa; padding: 15px; border-radius: 8px; border: 1px dashed #f57224; margin-top: 10px; margin-bottom: 15px; font-size: 13px;">
                                <div style="color: #f57224; font-weight: bold; margin-bottom: 15px; text-align: center; font-size: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 10px;">
                                    MÃ ĐƠN HÀNG: <span id="chk-order-id" style="font-size: 18px;">${currentCheckoutOrderId}</span>
                                </div>
                                <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                    <div style="flex: 1; min-width: 200px; line-height: 1.6;">
                                        <strong>Ngân hàng:</strong> MB Quân Đội<br>
                                        <strong>Chủ tài khoản:</strong> ${ACCOUNT_NAME}<br>
                                        <strong>Số tài khoản:</strong> ${BANK_ACCOUNT}<br>
                                        <strong>Số tiền:</strong> <span id="chk-qr-amount" style="color: #e74c3c; font-weight:bold; font-size:15px;">${total.toLocaleString('vi-VN')} đ</span><br>
                                        <strong>Nội dung CK:</strong> <span id="chk-qr-content" style="color: #e74c3c; font-weight:bold; font-size:15px;">${currentCheckoutOrderId}</span>
                                    </div>
                                    <div style="text-align: center; background: white; padding: 10px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                        <img id="chk-qr-img" src="${qrUrl}" alt="QR Ngân Hàng" style="width: 130px; height: 130px; border-radius: 4px; object-fit: contain;">
                                    </div>
                                </div>
                            </div>

                            <div class="chk-alert-box alert-gray">
                                <i class="fas fa-info-circle"></i>
                                <div>
                                    <strong>Lưu ý</strong>
                                    <span>Đơn hàng sẽ được xử lý và giao đến bạn trong thời gian sớm nhất.</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div class="chk-col-right">
                        <div class="chk-card-section chk-summary-section">
                            <div class="chk-sec-title">
                                <div class="step-circle">3</div>
                                <div>
                                    <h3>TÓM TẮT ĐƠN HÀNG</h3>
                                    <p>Kiểm tra lại sản phẩm và chi phí</p>
                                </div>
                            </div>

                            <div class="chk-product-list">
                                ${cartItemsHtml}
                            </div>

                            <div class="chk-cost-lines">
                                <div class="cost-line">
                                    <span>Tạm tính</span>
                                    <strong id="chk-subtotal">${subtotal.toLocaleString('vi-VN')} đ</strong>
                                </div>
                                <div class="cost-line">
                                    <span>Phí giao hàng</span>
                                    <strong>15.000 đ</strong>
                                </div>
                                <div class="cost-line free-ship-notice">
                                    <i class="fas fa-truck"></i> Phí ship đồng giá 15k toàn quốc
                                </div>
                            </div>

                            <div class="chk-total-wrapper">
                                <span>TỔNG CỘNG</span>
                                <span class="total-price-big" id="chk-total">${total.toLocaleString('vi-VN')} đ</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="chk-footer-area">
                    <button class="btn-final-submit btn-checkout-confirm" onclick="submitOrder()">
                        <div class="submit-left">
                            <i class="fas fa-lock"></i>
                            <div class="submit-texts">
                                <strong>HOÀN TẤT ĐẶT HÀNG</strong>
                                <span>Xác nhận thông tin và đặt hàng ngay</span>
                            </div>
                        </div>
                        <i class="fas fa-arrow-right right-arr"></i>
                    </button>
                    
                    <p class="terms-text">Bằng việc nhấn nút "Hoàn tất đặt hàng", bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của chúng tôi.</p>
                </div>

            </div>
        `;
        
        setupAddressAutocomplete(); 
    } else {
        document.getElementById('chk-subtotal').innerText = subtotal.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-total').innerText = total.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-order-id').innerText = currentCheckoutOrderId;
        document.getElementById('chk-qr-amount').innerText = total.toLocaleString('vi-VN') + ' đ';
        document.getElementById('chk-qr-content').innerText = currentCheckoutOrderId;
        document.getElementById('chk-qr-img').src = qrUrl;
        
        const listContainer = modal.querySelector('.chk-product-list');
        if (listContainer) {
            listContainer.innerHTML = cart.map(item => `
                <div class="chk-item-row">
                    <img src="${item.image}" alt="${item.title}" onerror="this.src='images/icon-logo.png'">
                    <div class="chk-item-info">
                        <div class="chk-item-title">${item.title}</div>
                        <div class="chk-item-variant">Màu/Phân loại: ${item.variant}</div>
                        <div class="chk-item-qty-label">SL: ${item.quantity}</div>
                    </div>
                    <div class="chk-item-price">
                        <div class="price">${Number(item.price).toLocaleString('vi-VN')} đ</div>
                        <div class="qty">x ${item.quantity}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // Đổ dữ liệu Tỉnh thành vào (nếu đã tải xong ở Background)
    const pSelect = document.getElementById('chk-province');
    if (pSelect && vnProvinces.length > 0 && pSelect.options.length <= 1) {
        vnProvinces.forEach(p => {
            pSelect.add(new Option(p.name, p.code));
        });
    }

    modal.classList.add('active');
    
    // KHÓA ĐỘ TRỄ: Đợi đúng 350ms (Cho Popup mở xong hoàn toàn) mới vẽ Select2
    // Việc này sẽ khắc phục 100% lỗi icon lộn xộn và khung chọn bị ép còn 0px
    setTimeout(() => {
        applySelect2();
    }, 350);
}

window.closeCheckoutModal = function() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
};

window.toggleBankInfo = function() {
    const checkedInput = document.querySelector('input[name="chk-payment"]:checked');
    const method = checkedInput ? checkedInput.value : 'cod';
    const box = document.getElementById('bank-info-box');
    if (box) box.style.display = method === 'bank' ? 'block' : 'none';
};

// ==========================================
// TẢI DỮ LIỆU ĐỊA CHỈ NGẦM (BACKGROUND PRE-LOAD) VÀ CACHE
// ==========================================
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
            document.head.appendChild(s2Script);
        };
        document.head.appendChild(script);
    }
})();

// Hàm tải dữ liệu được gọi NGAY KHI VÀO TRANG, không chờ ấn thanh toán
// TỐI ƯU TỐC ĐỘ: chỉ tải DANH SÁCH TÊN Tỉnh/Thành (depth=1) - rất nhẹ, hiện gần như ngay lập tức.
// Quận/Huyện và Xã/Phường của từng tỉnh sẽ được tải riêng (on-demand) khi khách chọn tỉnh đó,
// thay vì tải toàn bộ dữ liệu cả nước (depth=3) ngay từ đầu như trước (gây chậm 5-10s).
async function preFetchProvinces() {
    if (vnProvinces.length > 0) return;
    try {
        let cachedData = localStorage.getItem('morachi_vn_provinces_light');
        if (cachedData) {
            vnProvinces = JSON.parse(cachedData);
        } else {
            const res = await fetch('https://provinces.open-api.vn/api/?depth=1');
            vnProvinces = await res.json();
            try { localStorage.setItem('morachi_vn_provinces_light', JSON.stringify(vnProvinces)); } catch(e){}
        }
        // Xoá cache nặng kiểu cũ (toàn bộ cả nước) nếu trình duyệt khách còn lưu từ trước
        try { localStorage.removeItem('morachi_vn_provinces'); } catch(e){}
    } catch (e) { console.error("Lỗi API địa chỉ:", e); }
}

// Tải Quận/Huyện + Phường/Xã CHỈ CHO 1 TỈNH cụ thể (on-demand), thay vì cả nước.
// Có cache riêng từng tỉnh trong localStorage để lần sau chọn lại là có ngay, không cần gọi mạng nữa.
async function ensureProvinceDetail(pCode) {
    const idx = vnProvinces.findIndex(x => x.code == pCode);
    if (idx === -1) return null;
    let p = vnProvinces[idx];

    if (p.districts && p.districts.length > 0) return p; // đã có sẵn trong bộ nhớ rồi

    try {
        const cached = localStorage.getItem('morachi_vn_p_' + pCode);
        if (cached) {
            const districts = JSON.parse(cached);
            vnProvinces[idx] = { ...p, districts };
            return vnProvinces[idx];
        }
    } catch (e) {}

    try {
        const res = await fetch(`https://provinces.open-api.vn/api/p/${pCode}?depth=3`);
        const detail = await res.json();
        const districts = detail.districts || [];
        vnProvinces[idx] = { ...p, districts };
        try { localStorage.setItem('morachi_vn_p_' + pCode, JSON.stringify(districts)); } catch(e){}
        return vnProvinces[idx];
    } catch (e) {
        console.error('Lỗi tải Quận/Huyện cho tỉnh mã ' + pCode, e);
        return p;
    }
}

function applySelect2() {
    if (typeof jQuery === 'undefined' || typeof jQuery.fn.select2 === 'undefined') {
        setTimeout(applySelect2, 300);
        return;
    }

    const modalEl = $('#checkout-modal');

    // Nếu lỡ có Select2 cũ bị kẹt, hủy nó đi trước khi tạo mới
    if ($('#chk-province').hasClass("select2-hidden-accessible")) {
        $('#chk-province').select2('destroy');
        $('#chk-district').select2('destroy');
        $('#chk-ward').select2('destroy');
    }

    $('#chk-province').select2({ width: '100%', placeholder: 'Tỉnh/Thành phố', dropdownParent: modalEl });
    $('#chk-district').select2({ width: '100%', placeholder: 'Quận/Huyện', dropdownParent: modalEl });
    $('#chk-ward').select2({ width: '100%', placeholder: 'Phường/Xã', dropdownParent: modalEl });

    $('#chk-province').off('change').on('change', window.loadDistricts);
    $('#chk-district').off('change').on('change', window.loadWards);

    $(document).off('select2:open').on('select2:open', () => {
        setTimeout(() => {
            const searchField = document.querySelector('.select2-search__field');
            if (searchField) searchField.focus();
        }, 50);
    });
}

window.loadDistricts = async function() {
    if (typeof jQuery === 'undefined') return;
    const pCode = $('#chk-province').val();
    const dSelect = $('#chk-district');
    const wSelect = $('#chk-ward');

    wSelect.empty().append('<option value="">Phường/Xã</option>').trigger('change');

    if(!pCode) {
        dSelect.empty().append('<option value="">Quận/Huyện</option>').trigger('change');
        return;
    }

    // Hiện trạng thái đang tải trong lúc chờ dữ liệu của riêng tỉnh này
    dSelect.prop('disabled', true).empty().append('<option value="">Đang tải...</option>').trigger('change');

    const p = await ensureProvinceDetail(pCode);

    dSelect.empty().append('<option value="">Quận/Huyện</option>');
    if (p && p.districts) {
        p.districts.forEach(d => {
            dSelect.append(new Option(d.name, d.code));
        });
    }
    dSelect.prop('disabled', false).trigger('change');
};

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
    const d = (p && p.districts) ? p.districts.find(x => x.code == dCode) : null;
    if(d && d.wards) {
        d.wards.forEach(w => {
            wSelect.append(new Option(w.name, w.code));
        });
    }
    wSelect.trigger('change');
};

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
};

// ==============================================================
// XỬ LÝ ĐẶT HÀNG VÀ BẮN API VÀO DATABASE
// ==============================================================
window.submitOrder = async function() {
    const btn = document.querySelector('.btn-checkout-confirm');
    btn.disabled = true;
    
    const textNode = btn.querySelector('.submit-texts strong');
    if(textNode) textNode.innerText = "ĐANG XỬ LÝ...";

    const name = document.getElementById('chk-name').value.trim();
    const phone = document.getElementById('chk-phone').value.trim();
    const address = document.getElementById('chk-address').value.trim();
    
    if (!name || !phone || !address || !document.getElementById('chk-province').value) {
        alert("Vui lòng điền đầy đủ Thông tin giao hàng!");
        if(textNode) textNode.innerText = "HOÀN TẤT ĐẶT HÀNG";
        btn.disabled = false;
        return;
    }

    // Kiểm tra xem có hàng Order không
    let hasOrderItems = false;
    let orderDetails = [];
    
    cart.forEach(item => {
        if (item.status === 'order' || item.status === 'out') {
            hasOrderItems = true;
            orderDetails.push(`
                <li style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #ddd; text-align: left;">
                    <div style="color: #333; font-weight: 600; font-size: 14px; margin-bottom: 4px;">${item.title}</div>
                    <div style="font-size: 13px; color: #666;">
                        Phân loại: <span style="color:#333;">${item.variant}</span><br>
                        Dự kiến có hàng: <span style="color: #e74c3c; font-weight: bold;">${item.date || 'Đang cập nhật'}</span>
                    </div>
                </li>
            `);
        }
    });

    if (hasOrderItems) {
        showCustomConfirmModal(orderDetails.join(''), 
            function() {
                executeOrderSubmit(btn, name, phone, address);
            }, 
            function() {
                if(textNode) textNode.innerText = "HOÀN TẤT ĐẶT HÀNG";
                btn.disabled = false;
            }
        );
    } else {
        executeOrderSubmit(btn, name, phone, address);
    }
};

async function executeOrderSubmit(btn, name, phone, address) {
    const textNode = btn.querySelector('.submit-texts strong');
    const provEl = document.getElementById('chk-province');
    const distEl = document.getElementById('chk-district');
    const wardEl = document.getElementById('chk-ward');
    
    const prov = provEl.options[provEl.selectedIndex] ? provEl.options[provEl.selectedIndex].text : '';
    const dist = distEl.options[distEl.selectedIndex] ? distEl.options[distEl.selectedIndex].text : '';
    const ward = wardEl.options[wardEl.selectedIndex] ? wardEl.options[wardEl.selectedIndex].text : '';

    const orderId = currentCheckoutOrderId;
    const checkedPayment = document.querySelector('input[name="chk-payment"]:checked');
    const method = checkedPayment ? checkedPayment.value : 'cod';
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 15000;
    
    const orderData = {
        order_id: orderId,
        customer_info: { name, phone, address, prov, dist, ward }, 
        items: cart,
        total_amount: totalAmount,
        payment_method: method,
        status: method === 'bank' ? 'Chờ xác nhận đã chuyển khoản' : 'Xác nhận đặt đơn Shipcod thành công'
    };

    let allOrders = [];
    try {
        allOrders = JSON.parse(localStorage.getItem('morachi_orders') || '[]');
        if (!Array.isArray(allOrders)) allOrders = [];
    } catch (e) {
        console.error('Dữ liệu morachi_orders bị lỗi, đã reset:', e);
        allOrders = [];
    }
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

        showSuccessModal(name, orderId, method);

        cart = [];
        saveCart();
        closeCheckoutModal();
        
        if(textNode) textNode.innerText = "HOÀN TẤT ĐẶT HÀNG";
        btn.disabled = false;
    }
}

// ==============================================================
// HÀM TẠO GIAO DIỆN POPUP ĐẶT HÀNG THÀNH CÔNG ĐẸP MẮT
// ==============================================================
function showSuccessModal(name, orderId, method) {
    let oldModal = document.getElementById('custom-success-modal');
    if (oldModal) oldModal.remove();

    let methodMsg = "";
    if (method === 'bank') {
        methodMsg = "Vui lòng đảm bảo bạn đã quét mã QR để chuyển khoản. Hệ thống Admin đã ghi nhận đơn hàng.";
    } else {
        methodMsg = "Chúng tôi sẽ đóng gói và thu tiền mặt (COD) tận nhà cho bạn.";
    }

    const modalHtml = `
    <div id="custom-success-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
        <div style="background: white; width: 90%; max-width: 450px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; transform: translateY(-20px); transition: transform 0.3s ease; font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; text-align: center;">
            
            <div style="background: #e8f8f0; padding: 30px 20px 20px;">
                <div style="width: 70px; height: 70px; background: #27ae60; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 35px; margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);">
                    <i class="fas fa-check"></i>
                </div>
                <h3 style="margin: 0; color: #219653; font-size: 20px; font-weight: bold;">ĐẶT HÀNG THÀNH CÔNG!</h3>
            </div>
            
            <div style="padding: 25px 20px;">
                <p style="margin-top: 0; color: #333; font-size: 15px; line-height: 1.5; font-weight: 500;">
                    Cảm ơn <strong style="color: #f57224;">${name}</strong> đã tin tưởng và mua sắm tại MORACHI!
                </p>
                
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px dashed #ddd; font-size: 14px; color: #555;">
                    <div style="margin-bottom: 5px;">Mã đơn hàng của bạn là:</div>
                    <div style="font-size: 22px; font-weight: bold; color: #f57224; letter-spacing: 1px;">${orderId}</div>
                </div>
                
                <p style="margin-bottom: 0; color: #666; font-size: 14px; line-height: 1.6;">
                    ${methodMsg}
                </p>
            </div>
            
            <div style="padding: 20px; background: #fafafa; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee;">
                <button id="btn-success-track" style="width: 100%; padding: 14px; border: none; background: #f57224; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(245, 114, 36, 0.3); font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <i class="fas fa-map-marker-alt"></i> TRA CỨU ĐƠN HÀNG
                </button>
                <button id="btn-success-close" style="width: 100%; padding: 12px; border: 1px solid #ddd; background: white; color: #555; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 13px;">
                    TIẾP TỤC MUA SẮM
                </button>
            </div>
            
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('custom-success-modal');
    const box = modal.querySelector('div');

    setTimeout(() => {
        modal.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    }, 10);

    const btnTrack = document.getElementById('btn-success-track');
    const btnClose = document.getElementById('btn-success-close');
    
    btnTrack.onmouseover = () => btnTrack.style.background = '#d35400';
    btnTrack.onmouseout = () => btnTrack.style.background = '#f57224';
    btnClose.onmouseover = () => btnClose.style.background = '#f5f5f5';
    btnClose.onmouseout = () => btnClose.style.background = 'white';

    btnClose.onclick = () => { 
        closeCustomSuccessModal(modal, box); 
    };
    btnTrack.onclick = () => { 
        closeCustomSuccessModal(modal, box);
        window.location.href = "tracking.html"; 
    };
}

function closeCustomSuccessModal(modal, box) {
    modal.style.opacity = '0';
    box.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        modal.remove();
    }, 300);
}

// ==============================================================
// HÀM TẠO GIAO DIỆN POPUP CẢNH BÁO HÀNG ORDER ĐẸP MẮT
// ==============================================================
function showCustomConfirmModal(itemsHtml, onConfirm, onCancel) {
    let oldModal = document.getElementById('custom-confirm-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
    <div id="custom-confirm-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;">
        <div style="background: white; width: 90%; max-width: 450px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); overflow: hidden; transform: translateY(-20px); transition: transform 0.3s ease; font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;">
            
            <div style="background: #fff5f0; padding: 20px; text-align: center; border-bottom: 1px solid #ffe0d2;">
                <div style="width: 50px; height: 50px; background: #f57224; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 10px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="margin: 0; color: #d35400; font-size: 16px; font-weight: bold;">LƯU Ý ĐƠN HÀNG</h3>
            </div>
            
            <div style="padding: 20px;">
                <p style="margin-top: 0; color: #333; font-size: 14px; line-height: 1.5; text-align: center;">
                    Trong đơn hàng của bạn có chứa sản phẩm <strong style="color: #e74c3c;">HÀNG ORDER / TẠM HẾT HÀNG</strong>:
                </p>
                
                <ul style="list-style: none; padding: 15px; margin: 15px 0; background: #f9f9f9; border-radius: 8px; max-height: 180px; overflow-y: auto; border: 1px solid #eee;">
                    ${itemsHtml}
                </ul>
                
                <p style="margin-bottom: 0; color: #333; font-size: 14px; text-align: center; font-weight: 500;">
                    Bạn có đồng ý tiếp tục đặt hàng và chờ giao theo ngày dự kiến không?
                </p>
            </div>
            
            <div style="padding: 15px 20px; background: #fafafa; display: flex; gap: 10px; border-top: 1px solid #eee;">
                <button id="btn-confirm-cancel" style="flex: 1; padding: 12px; border: 1px solid #ddd; background: white; color: #555; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; font-size: 13px;">XEM LẠI GIỎ HÀNG</button>
                <button id="btn-confirm-ok" style="flex: 1; padding: 12px; border: none; background: #f57224; color: white; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(245, 114, 36, 0.3); font-size: 13px;">ĐỒNG Ý ĐẶT HÀNG</button>
            </div>
            
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('custom-confirm-modal');
    const box = modal.querySelector('div');

    setTimeout(() => {
        modal.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    }, 10);

    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');
    
    btnCancel.onmouseover = () => btnCancel.style.background = '#f5f5f5';
    btnCancel.onmouseout = () => btnCancel.style.background = 'white';
    btnOk.onmouseover = () => btnOk.style.background = '#d35400';
    btnOk.onmouseout = () => btnOk.style.background = '#f57224';

    btnCancel.onclick = () => { closeCustomConfirmModal(modal, box, onCancel); };
    btnOk.onclick = () => { closeCustomConfirmModal(modal, box, onConfirm); };
}

function closeCustomConfirmModal(modal, box, callback) {
    modal.style.opacity = '0';
    box.style.transform = 'translateY(-20px)';
    setTimeout(() => {
        modal.remove();
        if (callback) callback();
    }, 300);
}

// KHAI BÁO TOÀN BỘ CSS MỚI VÀ FIX HIỂN THỊ SELECT2 DROPDOWN
let oldCheckoutStyle = document.getElementById('checkout-style');
if(oldCheckoutStyle) oldCheckoutStyle.remove();

const checkoutStyle = document.createElement('style');
checkoutStyle.id = 'checkout-style';
checkoutStyle.innerHTML = `
    .checkout-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; justify-content: center; align-items: center; visibility: hidden; opacity: 0; transition: 0.3s; padding: 20px;}
    .checkout-modal.active { visibility: visible; opacity: 1; }
    
    .new-checkout-layout { background: #f4f5f7; width: 100%; max-width: 1000px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2); transform: translateY(-20px); transition: 0.3s; display:flex; flex-direction: column; max-height: 95vh; font-family: 'Segoe UI', Tahoma, sans-serif;}
    .checkout-modal.active .new-checkout-layout { transform: translateY(0); }

    .chk-header-gradient { background: linear-gradient(135deg, #ff8c3a, #f55523); color: white; padding: 20px 30px; display: flex; justify-content: space-between; align-items: center; }
    .chk-hdr-left { display: flex; align-items: center; gap: 15px; }
    .chk-bag-icon { background: white; color: #f55523; width: 45px; height: 45px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .chk-hdr-left h2 { margin: 0 0 4px 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; }
    .chk-hdr-left p { margin: 0; font-size: 13px; opacity: 0.9; }
    .chk-hdr-right { display: flex; gap: 15px; align-items: center;}
    .chk-action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; opacity: 0.9; transition: 0.2s;}
    .chk-action-btn:hover { opacity: 1; transform: translateY(-2px); }
    .chk-action-btn i { width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; }
    .close-modal-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; margin-left: 10px; opacity: 0.8; }
    .close-modal-btn:hover { opacity: 1; }

    .chk-body-wrapper { display: flex; gap: 20px; padding: 20px 30px; overflow-y: auto; flex: 1; }
    .chk-col-left { flex: 1.6; display: flex; flex-direction: column; }
    .chk-col-right { flex: 1; display: flex; flex-direction: column; }

    .chk-card-section { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
    .chk-sec-title { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .step-circle { width: 28px; height: 28px; background: #f55523; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; }
    .chk-sec-title h3 { margin: 0 0 3px 0; font-size: 15px; color: #111; font-weight: 700; }
    .chk-sec-title p { margin: 0; font-size: 12px; color: #777; }

    .chk-input-group { position: relative; margin-bottom: 12px; }
    .chk-input-group i { position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #f55523; z-index: 10; font-size: 14px; pointer-events: none;}
    .chk-form-area input[type="text"], .chk-form-area input[type="tel"] { width: 100%; padding: 13px 15px 13px 40px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; color: #333; outline: none; transition: 0.2s; box-sizing: border-box;}
    .chk-form-area input:focus { border-color: #f55523; box-shadow: 0 0 0 3px rgba(245, 85, 35, 0.1); }
    .chk-select-row { display: flex; gap: 10px; }
    .chk-select-row .chk-input-group { flex: 1; }

    /* Fix triệt để Select2 CSS: Đảm bảo độ rộng 100% và canh lề chữ */
    .select2-container { width: 100% !important; display: block; }
    .chk-select-wrap .select2-container--default .select2-selection--single { height: 46px; border: 1px solid #e0e0e0; border-radius: 8px; outline: none; width: 100% !important; display: flex; align-items: center;}
    .chk-select-wrap .select2-container--default .select2-selection--single .select2-selection__rendered { padding-left: 40px !important; color: #333; font-size: 13.5px; width: 100%; text-align: left; }
    .chk-select-wrap .select2-container--default .select2-selection--single .select2-selection__arrow { height: 46px !important; right: 10px !important; }

    /* Fix Menu trỏ xuống */
    .select2-container--open { z-index: 999999 !important; }
    .select2-dropdown { border-color: #f55523; border-radius: 8px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.15); z-index: 999999 !important; }
    .select2-container--default .select2-results__option--highlighted[aria-selected], .select2-container--default .select2-results__option--highlighted.select2-results__option--selectable { background-color: #f55523 !important; color: white !important;}

    .chk-alert-box { display: flex; gap: 12px; padding: 12px 15px; border-radius: 8px; font-size: 12.5px; margin-top: 15px; }
    .chk-alert-box i { font-size: 18px; margin-top: 2px; }
    .chk-alert-box strong { display: block; margin-bottom: 2px; font-size: 13px; }
    .alert-orange { background: #fff5eb; color: #d35400; border: 1px dashed #ffbca8; }
    .alert-gray { background: #f8f9fa; color: #555; border: 1px dashed #ddd; }

    .payment-card { display: flex; align-items: center; padding: 15px; border: 1px solid #e0e0e0; border-radius: 10px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; position: relative; }
    .payment-card:hover { border-color: #f55523; background: #fffaf7; }
    .payment-card i { font-size: 24px; margin-right: 15px; width: 30px; text-align: center; }
    .pay-info strong { display: block; font-size: 14px; color: #222; margin-bottom: 3px; }
    .pay-info span { font-size: 12px; color: #888; }
    .payment-card input[type="radio"] { position: absolute; opacity: 0; cursor: pointer; }
    .custom-radio { position: absolute; right: 15px; top: 50%; transform: translateY(-50%); height: 20px; width: 20px; border-radius: 50%; border: 2px solid #ddd; }
    .payment-card input:checked ~ .custom-radio { border-color: #f55523; background: #f55523; }
    .payment-card input:checked ~ .custom-radio:after { content: ""; position: absolute; top: 4px; left: 4px; width: 8px; height: 8px; border-radius: 50%; background: white; }
    .payment-card:has(input:checked) { border-color: #f55523; background: #fffaf7; }

    .chk-product-list { max-height: 250px; overflow-y: auto; border-bottom: 1px dashed #e0e0e0; padding-bottom: 15px; margin-bottom: 15px; }
    .chk-product-list::-webkit-scrollbar { width: 4px; }
    .chk-product-list::-webkit-scrollbar-thumb { background: #ddd; border-radius: 4px; }
    .chk-item-row { display: flex; gap: 12px; margin-bottom: 15px; align-items: center; }
    .chk-item-row img { width: 50px; height: 50px; border-radius: 6px; border: 1px solid #eee; object-fit: contain; }
    .chk-item-info { flex: 1; }
    .chk-item-title { font-size: 13px; font-weight: bold; color: #222; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 3px;}
    .chk-item-variant { font-size: 11px; color: #777; margin-bottom: 2px;}
    .chk-item-qty-label { font-size: 11px; color: #777; }
    .chk-item-price { text-align: right; }
    .chk-item-price .price { font-size: 13px; font-weight: bold; color: #111; }
    .chk-item-price .qty { font-size: 11px; color: #999; margin-top: 3px; }

    .cost-line { display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 10px; }
    .cost-line strong { color: #111; }
    .free-ship-notice { color: #e74c3c; font-size: 11px; font-weight: 500; margin-top: 5px; }
    
    .chk-total-wrapper { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; padding-top: 15px; margin-top: 10px; }
    .chk-total-wrapper span:first-child { font-weight: 800; font-size: 15px; color: #111; }
    .total-price-big { font-size: 22px; font-weight: bold; color: #f55523; }

    .chk-footer-area { padding: 20px 30px; background: white; border-top: 1px solid #eee; }

    .btn-final-submit { width: 100%; background: linear-gradient(90deg, #ff8c3a, #f55523); color: white; border: none; border-radius: 10px; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.3s; box-shadow: 0 5px 15px rgba(245, 85, 35, 0.3); outline: none;}
    .btn-final-submit:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(245, 85, 35, 0.4); }
    .submit-left { display: flex; align-items: center; gap: 15px; text-align: left;}
    .submit-left i { font-size: 22px; }
    .submit-texts strong { display: block; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px;}
    .submit-texts span { font-size: 12px; opacity: 0.9; }
    .right-arr { font-size: 20px; }

    .terms-text { text-align: center; font-size: 11px; color: #999; margin: 15px 0 0 0; }

    @media (max-width: 850px) {
        .chk-body-wrapper { flex-direction: column; padding: 15px; }
        .chk-select-row { flex-direction: column; }
        .chk-header-gradient { padding: 15px; flex-direction: column; gap: 15px; align-items: flex-start;}
        .chk-hdr-right { width: 100%; justify-content: space-between; }
        .chk-footer-area { padding: 15px; }
        .new-checkout-layout { max-height: 100vh; border-radius: 0; }
        .checkout-modal { padding: 0; }
    }
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
    preFetchProvinces(); // Kích hoạt tải dữ liệu địa chỉ ngầm ngay khi vào web
});