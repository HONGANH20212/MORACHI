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

// Dữ liệu dùng riêng cho popup thanh toán.
// Giúp nút "Mua ngay" chỉ đặt đúng 1 sản phẩm và không bị lẫn với giỏ hàng hiện có.
let checkoutItems = [];
let isBuyNowMode = false;

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
    const qtyToAdd = Math.max(1, Number(product && product.quantity) || 1);
    const normalizedProduct = normalizeCartItem({ ...(product || {}), quantity: qtyToAdd });
    const existingItem = cart.find(item => item.id === normalizedProduct.id && item.variant === normalizedProduct.variant);
    
    if (existingItem) {
        existingItem.quantity = Math.max(1, Number(existingItem.quantity) || 1) + qtyToAdd;
    } else {
        cart.push(normalizedProduct); 
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

function toPriceNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const cleaned = String(value ?? '').replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned) : 0;
}

function normalizeCartItem(item) {
    const quantity = Number(item && item.quantity) > 0 ? Number(item.quantity) : 1;
    return {
        ...(item || {}),
        price: toPriceNumber(item && item.price),
        quantity
    };
}

function cloneCheckoutItems(items) {
    return (Array.isArray(items) ? items : []).map(normalizeCartItem);
}

function getCheckoutSubtotal() {
    return checkoutItems.reduce((sum, item) => sum + (toPriceNumber(item.price) * Number(item.quantity || 1)), 0);
}

function renderCheckoutItemsHtml(items) {
    return cloneCheckoutItems(items).map(item => `
        <div class="chk-item-row">
            <img src="${item.image || 'images/icon-logo.png'}" alt="${item.title || 'Sản phẩm'}" onerror="this.src='images/icon-logo.png'">
            <div class="chk-item-info">
                <div class="chk-item-title">${item.title || 'Sản phẩm'}</div>
                <div class="chk-item-variant">Phân loại: ${item.variant || 'Mặc định'}</div>
                <div class="chk-item-qty-label">SL: ${item.quantity || 1}</div>
            </div>
            <div class="chk-item-price">
                <div class="price">${toPriceNumber(item.price).toLocaleString('vi-VN')} đ</div>
                <div class="qty">x ${item.quantity || 1}</div>
            </div>
        </div>
    `).join('');
}

// Hàm dùng cho nút "Mua ngay" ở trang chi tiết sản phẩm.
// Hàm này chỉ đưa 1 sản phẩm vào popup thanh toán, sau đó trả lại giỏ hàng cũ.
window.openBuyNowCheckout = function(item) {
    if (!item) return;

    const oldCart = cloneCheckoutItems(cart);
    isBuyNowMode = true;
    cart = [normalizeCartItem(item)];

    openCheckoutModal();

    cart = oldCart;
    updateCartUI();
};

// ==============================================================
// ĐỊA CHỈ NHẬN HÀNG LƯU RIÊNG TRÊN TỪNG THIẾT BỊ/TRÌNH DUYỆT
// - localStorage chỉ tồn tại trên đúng trình duyệt + thiết bị + domain hiện tại.
// - Không đồng bộ địa chỉ sang máy khác và không gửi địa chỉ lên server trước khi đặt hàng.
// ==============================================================
const MORACHI_ADDRESS_CACHE_KEY = 'morachi_checkout_addresses_v1';
const MORACHI_SELECTED_ADDRESS_KEY = 'morachi_checkout_selected_address_v1';
let checkoutEditingAddressId = '';
let checkoutTemporaryAddress = null;

function checkoutEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getCheckoutSavedAddresses() {
    try {
        const value = JSON.parse(localStorage.getItem(MORACHI_ADDRESS_CACHE_KEY) || '[]');
        return Array.isArray(value) ? value.filter(item => item && item.id) : [];
    } catch (error) {
        console.warn('Không đọc được cache địa chỉ MORACHI:', error);
        return [];
    }
}

function persistCheckoutSavedAddresses(addresses) {
    try {
        localStorage.setItem(MORACHI_ADDRESS_CACHE_KEY, JSON.stringify((addresses || []).slice(0, 10)));
        return true;
    } catch (error) {
        console.warn('Không lưu được cache địa chỉ MORACHI:', error);
        return false;
    }
}

function getCheckoutSelectedAddressId() {
    try {
        return localStorage.getItem(MORACHI_SELECTED_ADDRESS_KEY) || '';
    } catch (error) {
        return '';
    }
}

function setCheckoutSelectedAddressId(id) {
    try {
        if (id) localStorage.setItem(MORACHI_SELECTED_ADDRESS_KEY, String(id));
        else localStorage.removeItem(MORACHI_SELECTED_ADDRESS_KEY);
    } catch (error) {}
}

function getCheckoutSelectedAddress() {
    if (checkoutTemporaryAddress) return checkoutTemporaryAddress;
    const addresses = getCheckoutSavedAddresses();
    const selectedId = getCheckoutSelectedAddressId();
    return addresses.find(item => String(item.id) === String(selectedId)) || addresses[0] || null;
}

function buildCheckoutFullAddress(address) {
    if (!address) return '';
    const values = [address.address, address.wardName, address.districtName, address.provinceName]
        .map(value => String(value || '').trim())
        .filter(Boolean);
    const result = [];
    values.forEach(value => {
        const normalized = value.toLowerCase().replace(/\s+/g, ' ');
        const duplicated = result.some(existing => {
            const current = existing.toLowerCase().replace(/\s+/g, ' ');
            return current.includes(normalized) || normalized.includes(current);
        });
        if (!duplicated) result.push(value);
    });
    return result.join(', ');
}

function renderCheckoutAddressSummary() {
    const target = document.getElementById('chk-address-summary');
    if (!target) return;

    const selected = getCheckoutSelectedAddress();
    if (!selected) {
        target.innerHTML = `
            <button type="button" class="checkout-address-empty" onclick="openCheckoutAddressEditor()">
                <span class="checkout-address-empty-icon"><i class="fas fa-map-marker-alt"></i></span>
                <span>
                    <strong>Thêm địa chỉ nhận hàng</strong>
                    <small>Nhập thông tin giao hàng để tiếp tục đặt hàng</small>
                </span>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        return;
    }

    target.innerHTML = `
        <button type="button" class="checkout-address-selected" onclick="openCheckoutAddressList()">
            <span class="checkout-address-pin"><i class="fas fa-map-marker-alt"></i></span>
            <span class="checkout-address-copy">
                <span class="checkout-address-person">
                    <strong>${checkoutEscapeHtml(selected.name)}</strong>
                    <em></em>
                    <span>${checkoutEscapeHtml(selected.phone)}</span>
                </span>
                <span class="checkout-address-text">${checkoutEscapeHtml(buildCheckoutFullAddress(selected))}</span>
            </span>
            <i class="fas fa-chevron-right checkout-address-arrow"></i>
        </button>
    `;

    applyCheckoutAddressToForm(selected);
}

function applyCheckoutAddressToForm(address) {
    if (!address) return;
    const name = document.getElementById('chk-name');
    const phone = document.getElementById('chk-phone');
    const detail = document.getElementById('chk-address');
    if (name) name.value = address.name || '';
    if (phone) phone.value = address.phone || '';
    if (detail) detail.value = address.address || '';

    const province = document.getElementById('chk-province');
    const district = document.getElementById('chk-district');
    const ward = document.getElementById('chk-ward');
    if (province) {
        province.innerHTML = `<option value="${checkoutEscapeHtml(address.provinceCode || '')}" selected>${checkoutEscapeHtml(address.provinceName || 'Tỉnh/Thành phố')}</option>`;
    }
    if (district) {
        district.innerHTML = `<option value="${checkoutEscapeHtml(address.districtCode || '')}" selected>${checkoutEscapeHtml(address.districtName || 'Quận/Huyện')}</option>`;
    }
    if (ward) {
        ward.innerHTML = `<option value="${checkoutEscapeHtml(address.wardCode || '')}" selected>${checkoutEscapeHtml(address.wardName || 'Phường/Xã')}</option>`;
    }
}

function renderCheckoutAddressList() {
    const body = document.getElementById('checkout-address-sheet-body');
    const title = document.getElementById('checkout-address-sheet-title');
    if (!body || !title) return;

    title.textContent = 'Địa chỉ nhận hàng';
    const addresses = getCheckoutSavedAddresses();
    const selectedId = getCheckoutSelectedAddressId();

    body.innerHTML = `
        <div class="checkout-address-list">
            ${addresses.length ? addresses.map((item, index) => `
                <div class="checkout-address-list-item ${String(item.id) === String(selectedId) ? 'selected' : ''}">
                    <button type="button" class="checkout-address-radio" onclick="selectCheckoutSavedAddress('${checkoutEscapeHtml(item.id)}')" aria-label="Chọn địa chỉ">
                        <span></span>
                    </button>
                    <button type="button" class="checkout-address-list-main" onclick="selectCheckoutSavedAddress('${checkoutEscapeHtml(item.id)}')">
                        <span class="checkout-address-list-person"><strong>${checkoutEscapeHtml(item.name)}</strong><em></em>${checkoutEscapeHtml(item.phone)}</span>
                        <span>${checkoutEscapeHtml(buildCheckoutFullAddress(item))}</span>
                    </button>
                    <button type="button" class="checkout-address-edit-link" onclick="openCheckoutAddressEditor('${checkoutEscapeHtml(item.id)}')">Sửa</button>
                </div>
            `).join('') : `
                <div class="checkout-address-list-empty">
                    <i class="fas fa-map-marked-alt"></i>
                    <strong>Chưa có địa chỉ được lưu</strong>
                    <span>Địa chỉ chỉ được lưu trên thiết bị này.</span>
                </div>
            `}
            <button type="button" class="checkout-add-address-btn" onclick="openCheckoutAddressEditor()">
                <i class="fas fa-plus"></i> Thêm địa chỉ mới
            </button>
            <div class="checkout-device-cache-note">
                <i class="fas fa-shield-alt"></i>
                <div>
                    <strong>Dữ liệu được lưu (cache) tại thiết bị</strong>
                    <span>Thông tin địa chỉ và phương thức thanh toán chỉ được lưu trên trình duyệt này để dùng cho lần sau.</span>
                    <small><i class="fas fa-check"></i> Bảo mật và không tự đồng bộ sang thiết bị khác</small>
                </div>
            </div>
        </div>
    `;
}

window.openCheckoutAddressList = function() {
    const sheet = document.getElementById('checkout-address-sheet');
    if (!sheet) return;
    renderCheckoutAddressList();
    sheet.classList.add('active');
};

window.closeCheckoutAddressSheet = function() {
    const sheet = document.getElementById('checkout-address-sheet');
    if (sheet) sheet.classList.remove('active');
};

window.selectCheckoutSavedAddress = function(id) {
    const addresses = getCheckoutSavedAddresses();
    const address = addresses.find(item => String(item.id) === String(id));
    if (!address) return;
    checkoutTemporaryAddress = null;
    setCheckoutSelectedAddressId(address.id);
    applyCheckoutAddressToForm(address);
    renderCheckoutAddressSummary();
    closeCheckoutAddressSheet();
};

async function fillCheckoutAddressEditor(address) {
    await preFetchProvinces();

    const provinceSelect = document.getElementById('addr-province');
    const districtSelect = document.getElementById('addr-district');
    const wardSelect = document.getElementById('addr-ward');
    if (!provinceSelect || !districtSelect || !wardSelect) return;

    provinceSelect.innerHTML = '<option value="">Tỉnh / Thành phố</option>';
    vnProvinces.forEach(item => provinceSelect.add(new Option(item.name, item.code)));

    document.getElementById('addr-name').value = address?.name || '';
    document.getElementById('addr-phone').value = address?.phone || '';
    document.getElementById('addr-address').value = address?.address || '';
    document.getElementById('addr-save-address').checked = address ? true : true;

    if (address?.provinceCode) {
        provinceSelect.value = String(address.provinceCode);
        await checkoutAddressProvinceChanged();
        districtSelect.value = String(address.districtCode || '');
        checkoutAddressDistrictChanged();
        wardSelect.value = String(address.wardCode || '');
    } else {
        districtSelect.innerHTML = '<option value="">Quận / Huyện</option>';
        wardSelect.innerHTML = '<option value="">Phường / Xã</option>';
    }
}

window.openCheckoutAddressEditor = async function(id = '') {
    const body = document.getElementById('checkout-address-sheet-body');
    const title = document.getElementById('checkout-address-sheet-title');
    const sheet = document.getElementById('checkout-address-sheet');
    if (!body || !title || !sheet) return;

    const addresses = getCheckoutSavedAddresses();
    const address = id ? addresses.find(item => String(item.id) === String(id)) : null;
    checkoutEditingAddressId = address?.id || '';
    title.textContent = 'Địa chỉ nhận hàng';

    body.innerHTML = `
        <form class="checkout-address-form" onsubmit="event.preventDefault(); saveCheckoutAddress();">
            <label>Họ và tên</label>
            <input type="text" id="addr-name" placeholder="Nhập họ và tên" autocomplete="name" required>

            <label>Số điện thoại</label>
            <input type="tel" id="addr-phone" placeholder="Nhập số điện thoại" autocomplete="tel" required>

            <label>Tỉnh / Thành phố</label>
            <select id="addr-province" onchange="checkoutAddressProvinceChanged()" required>
                <option value="">Tỉnh / Thành phố</option>
            </select>

            <label>Quận / Huyện</label>
            <select id="addr-district" onchange="checkoutAddressDistrictChanged()" required>
                <option value="">Quận / Huyện</option>
            </select>

            <label>Phường / Xã</label>
            <select id="addr-ward" required>
                <option value="">Phường / Xã</option>
            </select>

            <label>Địa chỉ cụ thể</label>
            <div class="checkout-address-detail-wrap">
                <input type="text" id="addr-address" placeholder="Số nhà, tên đường, tòa nhà..." autocomplete="street-address" required>
                <div id="addr-address-suggestions" class="checkout-address-suggestions"></div>
            </div>

            <label class="checkout-save-address-toggle">
                <span>Lưu địa chỉ này</span>
                <input type="checkbox" id="addr-save-address" checked>
                <span class="checkout-toggle-ui"></span>
            </label>

            <button type="submit" class="checkout-save-address-submit">Lưu địa chỉ</button>
        </form>
    `;

    sheet.classList.add('active');
    await fillCheckoutAddressEditor(address);
    setupCheckoutAddressEditorAutocomplete();
};

function setupCheckoutAddressEditorAutocomplete() {
    const addressInput = document.getElementById('addr-address');
    const dropdown = document.getElementById('addr-address-suggestions');
    if (!addressInput || !dropdown || addressInput.dataset.autocompleteReady) return;
    addressInput.dataset.autocompleteReady = '1';

    addressInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        if (query.length < 3) {
            dropdown.style.display = 'none';
            return;
        }

        const province = document.getElementById('addr-province');
        const district = document.getElementById('addr-district');
        let context = '';
        if (district?.value) context += ', ' + district.options[district.selectedIndex].text;
        if (province?.value) context += ', ' + province.options[province.selectedIndex].text;

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + context)}&countrycodes=vn&format=json&limit=5`);
                const results = await response.json();
                if (!Array.isArray(results) || !results.length) {
                    dropdown.style.display = 'none';
                    return;
                }
                dropdown.innerHTML = results.map((item, index) => `
                    <button type="button" data-index="${index}"><i class="fas fa-map-marker-alt"></i>${checkoutEscapeHtml(item.display_name)}</button>
                `).join('');
                dropdown.style.display = 'block';
                dropdown.querySelectorAll('button').forEach(button => {
                    button.onclick = () => {
                        const item = results[Number(button.dataset.index)];
                        const parts = String(item.display_name || '').split(',');
                        addressInput.value = [parts[0], parts[1]].filter(Boolean).map(value => value.trim()).join(', ');
                        dropdown.style.display = 'none';
                    };
                });
            } catch (error) {
                dropdown.style.display = 'none';
            }
        }, 500);
    });
}

window.checkoutAddressProvinceChanged = async function() {
    const provinceSelect = document.getElementById('addr-province');
    const districtSelect = document.getElementById('addr-district');
    const wardSelect = document.getElementById('addr-ward');
    if (!provinceSelect || !districtSelect || !wardSelect) return;

    const provinceCode = provinceSelect.value;
    districtSelect.innerHTML = '<option value="">Đang tải...</option>';
    districtSelect.disabled = true;
    wardSelect.innerHTML = '<option value="">Phường / Xã</option>';

    if (!provinceCode) {
        districtSelect.innerHTML = '<option value="">Quận / Huyện</option>';
        districtSelect.disabled = false;
        return;
    }

    const province = await ensureProvinceDetail(provinceCode);
    districtSelect.innerHTML = '<option value="">Quận / Huyện</option>';
    (province?.districts || []).forEach(item => districtSelect.add(new Option(item.name, item.code)));
    districtSelect.disabled = false;
};

window.checkoutAddressDistrictChanged = function() {
    const provinceCode = document.getElementById('addr-province')?.value;
    const districtCode = document.getElementById('addr-district')?.value;
    const wardSelect = document.getElementById('addr-ward');
    if (!wardSelect) return;

    wardSelect.innerHTML = '<option value="">Phường / Xã</option>';
    const province = vnProvinces.find(item => String(item.code) === String(provinceCode));
    const district = (province?.districts || []).find(item => String(item.code) === String(districtCode));
    (district?.wards || []).forEach(item => wardSelect.add(new Option(item.name, item.code)));
};

window.saveCheckoutAddress = function() {
    const name = document.getElementById('addr-name')?.value.trim() || '';
    const phone = document.getElementById('addr-phone')?.value.trim() || '';
    const provinceSelect = document.getElementById('addr-province');
    const districtSelect = document.getElementById('addr-district');
    const wardSelect = document.getElementById('addr-ward');
    const detail = document.getElementById('addr-address')?.value.trim() || '';
    const saveOnDevice = document.getElementById('addr-save-address')?.checked !== false;

    if (!name || !phone || !provinceSelect?.value || !districtSelect?.value || !wardSelect?.value || !detail) {
        alert('Vui lòng nhập đầy đủ thông tin địa chỉ nhận hàng.');
        return;
    }

    const phonePattern = /^(0|\+84)[0-9\s.-]{8,13}$/;
    if (!phonePattern.test(phone)) {
        alert('Số điện thoại chưa đúng định dạng.');
        return;
    }

    const address = {
        id: checkoutEditingAddressId || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        phone,
        provinceCode: provinceSelect.value,
        provinceName: provinceSelect.options[provinceSelect.selectedIndex]?.text || '',
        districtCode: districtSelect.value,
        districtName: districtSelect.options[districtSelect.selectedIndex]?.text || '',
        wardCode: wardSelect.value,
        wardName: wardSelect.options[wardSelect.selectedIndex]?.text || '',
        address: detail,
        updatedAt: new Date().toISOString()
    };

    checkoutTemporaryAddress = address;

    if (saveOnDevice) {
        const addresses = getCheckoutSavedAddresses();
        const index = addresses.findIndex(item => String(item.id) === String(address.id));
        if (index >= 0) addresses[index] = address;
        else addresses.unshift(address);
        persistCheckoutSavedAddresses(addresses);
        setCheckoutSelectedAddressId(address.id);
        checkoutTemporaryAddress = null;
    }

    applyCheckoutAddressToForm(address);
    renderCheckoutAddressSummary();
    closeCheckoutAddressSheet();
};

async function initializeCheckoutAddressCache() {
    await preFetchProvinces();
    const selected = getCheckoutSelectedAddress();
    if (selected) {
        if (!getCheckoutSelectedAddressId() && selected.id) setCheckoutSelectedAddressId(selected.id);
        applyCheckoutAddressToForm(selected);
    }
    renderCheckoutAddressSummary();
}

function renderCheckoutOrderItems(items) {
    return cloneCheckoutItems(items).map(item => `
        <div class="checkout-order-product">
            <img src="${checkoutEscapeHtml(item.image || 'images/icon-logo.png')}" alt="${checkoutEscapeHtml(item.title || 'Sản phẩm')}" onerror="this.src='images/icon-logo.png'">
            <div class="checkout-order-product-info">
                <strong>${checkoutEscapeHtml(item.title || 'Sản phẩm')}</strong>
                <span>Phân loại: ${checkoutEscapeHtml(item.variant || 'Mặc định')}</span>
                <span>SL: ${Number(item.quantity || 1)}</span>
                <b>${toPriceNumber(item.price).toLocaleString('vi-VN')}đ</b>
            </div>
        </div>
    `).join('');
}

function openCheckoutModal() {
    if (!Array.isArray(cart) || cart.length === 0) {
        alert('Giỏ hàng của bạn đang trống!');
        return;
    }

    checkoutItems = cloneCheckoutItems(cart);

    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');

    const shippingFee = 15000;
    const subtotal = getCheckoutSubtotal();
    const total = subtotal + shippingFee;

    const timestamp = Date.now().toString();
    const randomNum = Math.floor(10 + Math.random() * 90);
    currentCheckoutOrderId = 'MO' + timestamp.slice(-4) + randomNum;

    const BANK_ACCOUNT = '2470168848012';
    const ACCOUNT_NAME = 'VO THI HONG ANH';
    const qrUrl = 'images/Screenshot_222.png';

    let modal = document.getElementById('checkout-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'checkout-modal';
        modal.className = 'checkout-modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="checkout-box checkout-mobile-order">
            <header class="checkout-mobile-header">
                <button type="button" onclick="closeCheckoutModal()" aria-label="Quay lại"><i class="fas fa-arrow-left"></i></button>
                <h2>Đặt hàng</h2>
                <span></span>
            </header>

            <main class="checkout-mobile-content">
                <section class="checkout-order-section checkout-address-section">
                    <div class="checkout-section-title">
                        <span>1</span>
                        <h3>Địa chỉ nhận hàng</h3>
                    </div>
                    <div id="chk-address-summary"></div>
                    <button type="button" class="checkout-add-address-inline" onclick="openCheckoutAddressEditor()">
                        <i class="fas fa-plus"></i> Thêm địa chỉ mới
                    </button>
                </section>

                <section class="checkout-order-section">
                    <div class="checkout-section-title dark">
                        <span>2</span>
                        <h3>Thông tin đơn hàng</h3>
                    </div>
                    <div class="checkout-order-products">${renderCheckoutOrderItems(checkoutItems)}</div>
                    <div class="checkout-cost-summary">
                        <div><span>Tạm tính</span><strong>${subtotal.toLocaleString('vi-VN')}đ</strong></div>
                        <div><span>Phí vận chuyển</span><strong>${shippingFee.toLocaleString('vi-VN')}đ</strong></div>
                        <div><span>Giảm giá</span><strong>-</strong></div>
                        <div class="checkout-grand-total"><span>Tổng cộng</span><strong id="chk-total">${total.toLocaleString('vi-VN')}đ</strong></div>
                    </div>
                </section>

                <section class="checkout-order-section">
                    <div class="checkout-section-title dark">
                        <span>3</span>
                        <h3>Phương thức thanh toán</h3>
                    </div>
                    <div class="checkout-payment-list">
                        <label class="checkout-payment-option">
                            <i class="fas fa-money-bill-wave cod-icon"></i>
                            <span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán bằng tiền mặt khi nhận hàng</small></span>
                            <input type="radio" name="chk-payment" value="cod" checked onchange="toggleBankInfo()">
                            <em></em>
                        </label>
                        <label class="checkout-payment-option">
                            <i class="fas fa-university bank-icon"></i>
                            <span><strong>Chuyển khoản qua VietQR</strong><small>Mã QR tự động điền số tiền &amp; nội dung đơn hàng</small></span>
                            <input type="radio" name="chk-payment" value="bank" onchange="toggleBankInfo()">
                            <em></em>
                        </label>
                    </div>

                    <div id="bank-info-box" class="checkout-bank-box" style="display:none;">
                        <strong>Mã đơn hàng: <span id="chk-order-id">${currentCheckoutOrderId}</span></strong>
                        <div class="checkout-bank-content">
                            <div>
                                <span>Ngân hàng: MB Quân Đội</span>
                                <span>Chủ tài khoản: ${ACCOUNT_NAME}</span>
                                <span>Số tài khoản: ${BANK_ACCOUNT}</span>
                                <span>Số tiền: <b id="chk-qr-amount">${total.toLocaleString('vi-VN')}đ</b></span>
                                <span>Nội dung CK: <b id="chk-qr-content">${currentCheckoutOrderId}</b></span>
                            </div>
                            <img id="chk-qr-img" src="${qrUrl}" alt="QR chuyển khoản">
                        </div>
                    </div>
                </section>
            </main>

            <footer class="checkout-mobile-footer">
                <button class="btn-checkout-confirm" onclick="submitOrder()">
                    <span class="submit-texts"><strong>Đặt hàng</strong><small>Xác nhận thông tin và tạo đơn hàng</small></span>
                </button>
                <p><i class="fas fa-lock"></i> Thông tin của bạn được bảo mật</p>
            </footer>

            <div id="checkout-address-sheet" class="checkout-address-sheet" aria-hidden="true">
                <div class="checkout-address-sheet-backdrop" onclick="closeCheckoutAddressSheet()"></div>
                <div class="checkout-address-sheet-panel">
                    <header>
                        <button type="button" onclick="closeCheckoutAddressSheet()"><i class="fas fa-times"></i></button>
                        <h3 id="checkout-address-sheet-title">Địa chỉ nhận hàng</h3>
                        <span></span>
                    </header>
                    <div id="checkout-address-sheet-body" class="checkout-address-sheet-body"></div>
                </div>
            </div>

            <div class="checkout-hidden-address-fields" aria-hidden="true">
                <input id="chk-name" type="text">
                <input id="chk-phone" type="tel">
                <select id="chk-province"><option value="">Tỉnh / Thành phố</option></select>
                <select id="chk-district"><option value="">Quận / Huyện</option></select>
                <select id="chk-ward"><option value="">Phường / Xã</option></select>
                <input id="chk-address" type="text">
                <div id="address-suggestions"></div>
            </div>
        </div>
    `;

    modal.classList.add('active');
    document.documentElement.classList.add('checkout-open');
    document.body.classList.add('checkout-open');
    initializeCheckoutAddressCache();
}


window.closeCheckoutModal = function() {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.classList.remove('active');
    document.documentElement.classList.remove('checkout-open');
    document.body.classList.remove('checkout-open');
    checkoutItems = [];
    isBuyNowMode = false;
    checkoutEditingAddressId = '';
    checkoutTemporaryAddress = null;
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
    if (typeof jQuery === 'undefined' || typeof jQuery.fn.select2 === 'undefined') return;

    const $selects = $('#chk-province, #chk-district, #chk-ward');

    // Nếu Select2 đã khởi tạo rồi thì hủy trước để tránh bị nhân đôi layout/event
    $selects.each(function () {
        if ($(this).data('select2')) {
            $(this).select2('destroy');
        }
    });

    const select2Options = {
        width: '100%',
        dropdownParent: $('body'), // đưa dropdown ra body để không làm modal/card bị co giãn
        dropdownAutoWidth: false,
        minimumResultsForSearch: 8
    };

    $('#chk-province').select2(select2Options);
    $('#chk-district').select2(select2Options);
    $('#chk-ward').select2(select2Options);

    $('.select2-container').css({
        width: '100%',
        minWidth: '0',
        maxWidth: '100%'
    });

    function updateSelect2FullTitle() {
        $('#chk-province, #chk-district, #chk-ward').each(function () {
            const text = $(this).find('option:selected').text() || '';
            const $rendered = $(this)
                .next('.select2-container')
                .find('.select2-selection__rendered');

            $rendered.attr('title', text);
        });
    }

    // Gỡ event cũ trước khi gắn event mới để không bị gọi nhiều lần
    $('#chk-province')
        .off('select2:select.morachi')
        .on('select2:select.morachi', async function () {
            await window.loadDistricts();
            updateSelect2FullTitle();
        });

    $('#chk-district')
        .off('select2:select.morachi')
        .on('select2:select.morachi', function () {
            window.loadWards();
            updateSelect2FullTitle();
        });

    $('#chk-province, #chk-district, #chk-ward')
        .off('change.morachiTitle')
        .on('change.morachiTitle', updateSelect2FullTitle);

    updateSelect2FullTitle();
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
        p.districts.forEach(d => dSelect.append(new Option(d.name, d.code)));
    }
    
    // Ép Select2 cập nhật giao diện
    dSelect.trigger('change'); 
    dSelect.prop('disabled', false);
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
    if(textNode) textNode.innerText = "Đang xử lý...";

    const name = document.getElementById('chk-name').value.trim();
    const phone = document.getElementById('chk-phone').value.trim();
    const address = document.getElementById('chk-address').value.trim();
    
    if (!name || !phone || !address || !document.getElementById('chk-province').value) {
        alert("Vui lòng điền đầy đủ Thông tin giao hàng!");
        if(textNode) textNode.innerText = "Đặt hàng";
        btn.disabled = false;
        return;
    }

    // Phòng trường hợp trình duyệt bị cache hoặc popup bị mở lại, không để đơn hàng gửi lên bị rỗng sản phẩm.
    if ((!checkoutItems || checkoutItems.length === 0) && Array.isArray(cart) && cart.length > 0) {
        checkoutItems = cloneCheckoutItems(cart);
    }

    if (!checkoutItems || checkoutItems.length === 0) {
        alert("Không tìm thấy sản phẩm trong đơn hàng. Vui lòng thử lại!");
        if(textNode) textNode.innerText = "Đặt hàng";
        btn.disabled = false;
        return;
    }

    // Kiểm tra xem có hàng Order không
    let hasOrderItems = false;
    let orderDetails = [];
    
    checkoutItems.forEach(item => {
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
                if(textNode) textNode.innerText = "Đặt hàng";
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
    const paymentLabel = method === 'bank' ? 'Chuyển khoản VietQR' : 'Ship COD';
    const paymentStatus = method === 'bank' ? 'Cần kiểm tra sao kê' : 'Thu tiền khi giao hàng';
    const orderItems = cloneCheckoutItems(checkoutItems);
    const totalAmount = orderItems.reduce((sum, item) => sum + (toPriceNumber(item.price) * Number(item.quantity || 1)), 0) + 15000;
    
    const orderData = {
        order_id: orderId,
        customer_info: { name, phone, address, prov, dist, ward },
        customer_name: name,
        customer_phone: phone,
        customer_address: `${address}, ${ward}, ${dist}, ${prov}`.replace(/^,\s*|,\s*$/g, ''),
        items: orderItems,
        products: orderItems,
        total_amount: totalAmount,
        total: totalAmount,
        payment_method: method,
        payment_label: paymentLabel,
        payment_status: paymentStatus,
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

        if (!isBuyNowMode) {
            cart = [];
            saveCart();
        }

        checkoutItems = [];
        isBuyNowMode = false;
        closeCheckoutModal();
        
        if(textNode) textNode.innerText = "Đặt hàng";
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
    html.checkout-open,
    body.checkout-open { overflow: hidden !important; }

    .checkout-modal {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(20, 20, 24, .58);
        opacity: 0;
        visibility: hidden;
        transition: opacity .22s ease, visibility .22s ease;
        font-family: Inter, 'Segoe UI', Arial, sans-serif;
    }

    .checkout-modal.active { opacity: 1; visibility: visible; }

    .checkout-mobile-order {
        position: relative;
        width: min(100%, 540px);
        max-height: min(94vh, 880px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 22px;
        background: #fff;
        color: #222328;
        box-shadow: 0 24px 70px rgba(0,0,0,.24);
        transform: translateY(18px);
        transition: transform .22s ease;
    }

    .checkout-modal.active .checkout-mobile-order { transform: translateY(0); }

    .checkout-mobile-header {
        min-height: 62px;
        display: grid;
        grid-template-columns: 44px 1fr 44px;
        align-items: center;
        padding: 8px 14px;
        background: #fff;
        border-bottom: 1px solid #ececef;
        flex: 0 0 auto;
    }

    .checkout-mobile-header button {
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #c90d1b;
        font-size: 19px;
        cursor: pointer;
    }

    .checkout-mobile-header h2 {
        margin: 0;
        text-align: center;
        font-size: 17px;
        font-weight: 800;
        color: #1f2024;
    }

    .checkout-mobile-content {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding: 0 18px 18px;
        background: #fff;
    }

    .checkout-order-section {
        padding: 19px 0;
        border-bottom: 1px solid #ececef;
    }

    .checkout-order-section:last-child { border-bottom: 0; }

    .checkout-section-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 14px;
    }

    .checkout-section-title > span {
        width: 25px;
        height: 25px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #c90d1b;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        flex: 0 0 auto;
    }

    .checkout-section-title.dark > span { background: #2e3035; }

    .checkout-section-title h3 {
        margin: 0;
        color: #26272b;
        font-size: 14px;
        font-weight: 800;
    }

    .checkout-address-empty,
    .checkout-address-selected {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px;
        border: 1.5px solid #df2633;
        border-radius: 12px;
        background: #fff;
        color: #25262a;
        text-align: left;
        cursor: pointer;
    }

    .checkout-address-empty > span:nth-child(2),
    .checkout-address-copy { flex: 1; min-width: 0; }

    .checkout-address-empty strong,
    .checkout-address-empty small {
        display: block;
    }

    .checkout-address-empty strong { font-size: 13px; color: #c90d1b; }
    .checkout-address-empty small { margin-top: 4px; color: #7c7f86; font-size: 11px; line-height: 1.4; }

    .checkout-address-empty-icon,
    .checkout-address-pin {
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: #fff1f2;
        color: #c90d1b;
        flex: 0 0 auto;
    }

    .checkout-address-person {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 5px;
        font-size: 12px;
        line-height: 1.3;
    }

    .checkout-address-person strong { font-size: 13px; }
    .checkout-address-person em,
    .checkout-address-list-person em { width: 1px; height: 14px; background: #d7d8dc; }

    .checkout-address-text {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        color: #494c53;
        font-size: 11.5px;
        line-height: 1.45;
    }

    .checkout-address-arrow { color: #757981; font-size: 12px; }

    .checkout-add-address-inline {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 13px;
        padding: 7px 4px;
        border: 0;
        background: transparent;
        color: #c90d1b;
        font-size: 12px;
        font-weight: 750;
        cursor: pointer;
    }

    .checkout-order-products { display: flex; flex-direction: column; gap: 13px; }

    .checkout-order-product {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .checkout-order-product img {
        width: 82px;
        height: 82px;
        object-fit: contain;
        border: 1px solid #ececef;
        border-radius: 10px;
        background: #fff;
        flex: 0 0 auto;
    }

    .checkout-order-product-info { min-width: 0; flex: 1; }
    .checkout-order-product-info strong {
        display: -webkit-box;
        overflow: hidden;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        margin-bottom: 5px;
        color: #303136;
        font-size: 13px;
        line-height: 1.35;
    }
    .checkout-order-product-info span { display: block; color: #74777e; font-size: 11px; line-height: 1.45; }
    .checkout-order-product-info b { display: block; margin-top: 7px; color: #d20e1d; font-size: 13px; }

    .checkout-cost-summary {
        margin-top: 17px;
        padding-top: 12px;
        border-top: 1px solid #ededf0;
    }
    .checkout-cost-summary > div {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 6px 0;
        color: #4d5056;
        font-size: 12px;
    }
    .checkout-cost-summary strong { color: #34363a; font-weight: 700; }
    .checkout-cost-summary .checkout-grand-total {
        margin-top: 7px;
        padding-top: 12px;
        border-top: 1px solid #ededf0;
        align-items: center;
        color: #202126;
        font-weight: 800;
    }
    .checkout-cost-summary .checkout-grand-total strong { color: #d20e1d; font-size: 23px; }

    .checkout-payment-list { display: flex; flex-direction: column; gap: 10px; }
    .checkout-payment-option {
        position: relative;
        min-height: 65px;
        display: grid;
        grid-template-columns: 34px 1fr 22px;
        gap: 10px;
        align-items: center;
        padding: 12px 14px;
        border: 1px solid #e5e6e9;
        border-radius: 11px;
        background: #fff;
        cursor: pointer;
    }
    .checkout-payment-option:has(input:checked) { border-color: #db1c29; background: #fffafa; }
    .checkout-payment-option > i { font-size: 20px; text-align: center; }
    .checkout-payment-option .cod-icon { color: #2caf63; }
    .checkout-payment-option .bank-icon { color: #307ccb; }
    .checkout-payment-option > span { min-width: 0; }
    .checkout-payment-option strong,
    .checkout-payment-option small { display: block; }
    .checkout-payment-option strong { color: #34363a; font-size: 12px; line-height: 1.35; }
    .checkout-payment-option small { margin-top: 3px; color: #72757c; font-size: 10.5px; line-height: 1.35; }
    .checkout-payment-option input { position: absolute; opacity: 0; pointer-events: none; }
    .checkout-payment-option em {
        width: 17px;
        height: 17px;
        border: 1.5px solid #c8cad0;
        border-radius: 50%;
        background: #fff;
    }
    .checkout-payment-option input:checked + em { border: 5px solid #d20e1d; }

    .checkout-bank-box {
        margin-top: 12px;
        padding: 14px;
        border: 1px dashed #df5963;
        border-radius: 12px;
        background: #fff9f9;
        color: #3e4045;
        font-size: 11px;
    }
    .checkout-bank-box > strong { display: block; margin-bottom: 12px; color: #c90d1b; }
    .checkout-bank-content { display: flex; gap: 12px; align-items: center; }
    .checkout-bank-content > div { flex: 1; min-width: 0; }
    .checkout-bank-content span { display: block; margin: 4px 0; line-height: 1.35; }
    .checkout-bank-content b { color: #c90d1b; }
    .checkout-bank-content img { width: 105px; height: 105px; object-fit: contain; border-radius: 8px; background: #fff; }

    .checkout-mobile-footer {
        flex: 0 0 auto;
        padding: 12px 18px max(12px, env(safe-area-inset-bottom));
        border-top: 1px solid #ececef;
        background: rgba(255,255,255,.98);
        box-shadow: 0 -7px 20px rgba(0,0,0,.06);
    }
    .btn-checkout-confirm {
        width: 100%;
        min-height: 52px;
        border: 0;
        border-radius: 8px;
        background: linear-gradient(90deg, #dc0b1b, #c40b18);
        color: #fff;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(201,13,27,.18);
    }
    .btn-checkout-confirm:disabled { opacity: .68; cursor: wait; }
    .btn-checkout-confirm .submit-texts strong,
    .btn-checkout-confirm .submit-texts small { display: block; }
    .btn-checkout-confirm .submit-texts strong { font-size: 14px; font-weight: 800; }
    .btn-checkout-confirm .submit-texts small { margin-top: 2px; font-size: 10px; opacity: .88; }
    .checkout-mobile-footer p { margin: 8px 0 0; text-align: center; color: #7c7f86; font-size: 10px; }
    .checkout-mobile-footer p i { margin-right: 5px; }

    .checkout-address-sheet {
        position: absolute;
        inset: 0;
        z-index: 30;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity .2s ease, visibility .2s ease;
    }
    .checkout-address-sheet.active { pointer-events: auto; opacity: 1; visibility: visible; }
    .checkout-address-sheet-backdrop { position: absolute; inset: 0; background: rgba(18,18,22,.42); }
    .checkout-address-sheet-panel {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        max-height: 92%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 22px 22px 0 0;
        background: #fff;
        box-shadow: 0 -18px 46px rgba(0,0,0,.17);
        transform: translateY(25px);
        transition: transform .22s ease;
    }
    .checkout-address-sheet.active .checkout-address-sheet-panel { transform: translateY(0); }
    .checkout-address-sheet-panel > header {
        min-height: 58px;
        display: grid;
        grid-template-columns: 42px 1fr 42px;
        align-items: center;
        padding: 7px 12px;
        border-bottom: 1px solid #ececef;
    }
    .checkout-address-sheet-panel > header button {
        width: 38px;
        height: 38px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #55585e;
        cursor: pointer;
        font-size: 17px;
    }
    .checkout-address-sheet-panel > header h3 { margin: 0; text-align: center; font-size: 15px; font-weight: 800; }
    .checkout-address-sheet-body { min-height: 0; overflow-y: auto; padding: 10px 18px 18px; }

    .checkout-address-list-item {
        display: grid;
        grid-template-columns: 25px 1fr 38px;
        gap: 8px;
        align-items: center;
        padding: 14px 0;
        border-bottom: 1px solid #ececef;
    }
    .checkout-address-radio,
    .checkout-address-list-main,
    .checkout-address-edit-link { border: 0; background: transparent; cursor: pointer; }
    .checkout-address-radio { width: 22px; height: 22px; padding: 0; }
    .checkout-address-radio span {
        width: 16px;
        height: 16px;
        display: block;
        border: 1.5px solid #c8cad0;
        border-radius: 50%;
    }
    .checkout-address-list-item.selected .checkout-address-radio span { border: 5px solid #d20e1d; }
    .checkout-address-list-main { min-width: 0; padding: 0; text-align: left; color: #55585e; font-size: 11px; line-height: 1.45; }
    .checkout-address-list-person { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px; color: #3a3c41; }
    .checkout-address-list-person strong { font-size: 12px; }
    .checkout-address-edit-link { color: #d20e1d; font-size: 11px; font-weight: 750; }
    .checkout-add-address-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 13px 0 4px;
        padding: 8px 4px;
        border: 0;
        background: transparent;
        color: #d20e1d;
        font-size: 12px;
        font-weight: 750;
        cursor: pointer;
    }
    .checkout-address-list-empty { padding: 28px 10px; text-align: center; color: #7a7d84; }
    .checkout-address-list-empty i { display: block; margin-bottom: 10px; color: #d20e1d; font-size: 27px; }
    .checkout-address-list-empty strong,
    .checkout-address-list-empty span { display: block; }
    .checkout-address-list-empty strong { color: #34363a; font-size: 13px; }
    .checkout-address-list-empty span { margin-top: 5px; font-size: 11px; }

    .checkout-device-cache-note {
        display: flex;
        gap: 11px;
        margin-top: 14px;
        padding: 15px;
        border: 1px solid #f0dadc;
        border-radius: 13px;
        background: #fff8f7;
    }
    .checkout-device-cache-note > i { color: #3c3f45; font-size: 18px; }
    .checkout-device-cache-note strong,
    .checkout-device-cache-note span,
    .checkout-device-cache-note small { display: block; }
    .checkout-device-cache-note strong { color: #34363a; font-size: 12px; }
    .checkout-device-cache-note span { margin-top: 5px; color: #666a71; font-size: 10.5px; line-height: 1.45; }
    .checkout-device-cache-note small { margin-top: 9px; color: #249d58; font-size: 10px; }
    .checkout-device-cache-note small i { margin-right: 5px; }

    .checkout-address-form { padding-top: 4px; }
    .checkout-address-form > label:not(.checkout-save-address-toggle) {
        display: block;
        margin: 12px 0 6px;
        color: #35373c;
        font-size: 11px;
        font-weight: 700;
    }
    .checkout-address-form input[type="text"],
    .checkout-address-form input[type="tel"],
    .checkout-address-form select {
        width: 100%;
        height: 44px;
        padding: 0 12px;
        border: 1px solid #e0e1e5;
        border-radius: 8px;
        outline: none;
        background: #fff;
        color: #303237;
        font-size: 13px;
        box-sizing: border-box;
    }
    .checkout-address-form input:focus,
    .checkout-address-form select:focus { border-color: #d20e1d; box-shadow: 0 0 0 3px rgba(210,14,29,.07); }
    .checkout-address-detail-wrap { position: relative; }
    .checkout-address-suggestions {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 5;
        display: none;
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid #e0e1e5;
        border-radius: 9px;
        background: #fff;
        box-shadow: 0 10px 26px rgba(0,0,0,.13);
    }
    .checkout-address-suggestions button {
        width: 100%;
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border: 0;
        border-bottom: 1px solid #efeff1;
        background: #fff;
        color: #4a4d54;
        text-align: left;
        font-size: 10.5px;
        line-height: 1.4;
        cursor: pointer;
    }
    .checkout-address-suggestions button i { color: #d20e1d; margin-top: 2px; }

    .checkout-save-address-toggle {
        min-height: 44px;
        display: flex;
        align-items: center;
        margin-top: 12px;
        cursor: pointer;
    }
    .checkout-save-address-toggle > span:first-child { flex: 1; color: #404247; font-size: 11px; }
    .checkout-save-address-toggle input { position: absolute; opacity: 0; }
    .checkout-toggle-ui {
        position: relative;
        width: 42px;
        height: 24px;
        border-radius: 999px;
        background: #d8d9dd;
        transition: .18s ease;
    }
    .checkout-toggle-ui::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,.18);
        transition: .18s ease;
    }
    .checkout-save-address-toggle input:checked + .checkout-toggle-ui { background: #d20e1d; }
    .checkout-save-address-toggle input:checked + .checkout-toggle-ui::after { transform: translateX(18px); }
    .checkout-save-address-submit {
        width: 100%;
        height: 48px;
        margin-top: 13px;
        border: 0;
        border-radius: 8px;
        background: linear-gradient(90deg, #dc0b1b, #c40b18);
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
    }

    .checkout-hidden-address-fields { display: none !important; }

    @media (max-width: 600px) {
        .checkout-modal { padding: 0; background: #fff; }
        .checkout-mobile-order {
            width: 100%;
            height: 100%;
            max-height: none;
            border-radius: 0;
            box-shadow: none;
        }
        .checkout-mobile-content { padding-left: 15px; padding-right: 15px; }
        .checkout-order-product img { width: 78px; height: 78px; }
        .checkout-address-sheet-panel { max-height: 94%; }
    }

    @media (max-width: 360px) {
        .checkout-mobile-content { padding-left: 12px; padding-right: 12px; }
        .checkout-order-product img { width: 68px; height: 68px; }
        .checkout-cost-summary .checkout-grand-total strong { font-size: 20px; }
        .checkout-bank-content { align-items: flex-start; }
        .checkout-bank-content img { width: 88px; height: 88px; }
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