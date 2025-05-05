import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // CSRF token oluştur ve sakla
    const csrfToken = generateCSRFToken();
    sessionStorage.setItem('csrfToken', csrfToken);

    // Shop elementlerini seç
    const productGrid = document.querySelector('.product-grid');
    const cartItemsList = document.querySelector('.cart-items');
    const cartTotal = document.querySelector('.cart-total-amount');
    const checkoutButton = document.querySelector('.checkout-btn');
    const cartBadge = document.querySelector('.cart-badge');

    // Sepet durumu
    let cartItems = [];

    // Kullanıcı oturumunu kontrol et
    const { data: { session } } = await supabase.auth.getSession();
    let currentUser = null;

    if (session) {
        // Aktif kullanıcı bilgisini al
        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;

        // Varsa kaydedilmiş sepeti yükle
        await loadSavedCart(user.id);
    }

    // Ürünleri yükle
    await loadProducts();

    // Sepet butonları ve checkout dinleyicileri
    setupCartEventListeners();

    // CSRF token oluşturma fonksiyonu
    function generateCSRFToken() {
        const randomBytes = new Uint8Array(16);
        window.crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    // Ürünleri yükleme fonksiyonu
    async function loadProducts() {
        try {
            // Ürünleri veritabanından getir
            const { data: products, error } = await supabase
                .from('products')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!products || products.length === 0) {
                productGrid.innerHTML = '<p class="no-products">Henüz hiç ürün bulunmuyor.</p>';
                return;
            }

            // Ürünleri renderla
            renderProducts(products);

        } catch (error) {
            console.error('Ürünler yüklenirken hata:', error);
            productGrid.innerHTML = '<p class="error">Ürünler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.</p>';
        }
    }

    // Ürünleri render etme fonksiyonu
    function renderProducts(products) {
        productGrid.innerHTML = '';

        products.forEach(product => {
            const sanitizedName = sanitizeInput(product.name);
            const sanitizedDescription = sanitizeInput(product.description);
            const price = parseFloat(product.price).toFixed(2);

            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image">
                    <img src="${sanitizeInput(product.image_url)}" alt="${sanitizedName}" 
                        onerror="this.src='images/product-placeholder.jpg'">
                </div>
                <div class="product-details">
                    <h3 class="product-title">${sanitizedName}</h3>
                    <p class="product-description">${sanitizedDescription}</p>
                    <div class="product-price-actions">
                        <span class="product-price">${price} ₺</span>
                        <button class="add-to-cart-btn" data-product-id="${product.id}">
                            <i class="fas fa-shopping-cart"></i> Sepete Ekle
                        </button>
                    </div>
                </div>
            `;

            productGrid.appendChild(productCard);

            // Sepete ekle butonuna tıklama olayı
            const addToCartBtn = productCard.querySelector('.add-to-cart-btn');
            addToCartBtn.addEventListener('click', () => {
                addToCart(product);
            });
        });
    }

    // Sepet olay dinleyicileri
    function setupCartEventListeners() {
        // Sepeti görüntüle/gizle
        const cartToggle = document.querySelector('.cart-toggle');
        const cart = document.querySelector('.cart');

        if (cartToggle) {
            cartToggle.addEventListener('click', () => {
                cart.classList.toggle('cart-open');
            });
        }

        // Checkout butonu
        if (checkoutButton) {
            checkoutButton.addEventListener('click', async (e) => {
                e.preventDefault();

                if (!cartItems.length) {
                    showMessage('Lütfen önce sepetinize ürün ekleyin.', 'error');
                    return;
                }

                // Kullanıcı giriş yapmış mı kontrol et
                if (!currentUser) {
                    showMessage('Satın alma işlemi için giriş yapmanız gerekmektedir.', 'error');
                    // Kullanıcıyı login sayfasına yönlendir
                    setTimeout(() => {
                        window.location.href = 'login.html?redirect=shop.html';
                    }, 2000);
                    return;
                }

                // CSRF token ekleyerek ödeme sayfasına yönlendir
                showCheckoutForm();
            });
        }
    }

    // Ödeme formunu göster
    function showCheckoutForm() {
        // Mevcut checkout form varsa kaldır
        const existingForm = document.getElementById('checkout-form-container');
        if (existingForm) {
            existingForm.remove();
        }

        // Toplam tutarı hesapla
        const total = cartItems.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0).toFixed(2);

        // Checkout form container oluştur
        const formContainer = document.createElement('div');
        formContainer.id = 'checkout-form-container';
        formContainer.className = 'checkout-overlay';

        // Ödeme formu
        formContainer.innerHTML = `
            <div class="checkout-form">
                <button class="close-checkout-btn">&times;</button>
                <h2>Ödeme Bilgileri</h2>
                
                <div class="checkout-summary">
                    <h3>Sipariş Özeti</h3>
                    <div class="checkout-items">
                        ${cartItems.map(item =>
            `<div class="checkout-item">
                                <span>${sanitizeInput(item.name)} x ${item.quantity}</span>
                                <span>${(item.price * item.quantity).toFixed(2)} ₺</span>
                            </div>`
        ).join('')}
                    </div>
                    <div class="checkout-total">
                        <strong>Toplam:</strong>
                        <strong>${total} ₺</strong>
                    </div>
                </div>
                
                <form id="payment-form">
                    <input type="hidden" name="_csrf" value="${csrfToken}">
                    
                    <div class="form-group">
                        <label for="card-holder">Kart Sahibi</label>
                        <input type="text" id="card-holder" name="cardHolder" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="card-number">Kart Numarası</label>
                        <input type="text" id="card-number" name="cardNumber" 
                            pattern="[0-9]{16}" maxlength="16" placeholder="XXXX XXXX XXXX XXXX" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group half">
                            <label for="expiry-date">Son Kullanma Tarihi</label>
                            <input type="text" id="expiry-date" name="expiryDate" 
                                pattern="[0-9]{2}/[0-9]{2}" maxlength="5" placeholder="AA/YY" required>
                        </div>
                        
                        <div class="form-group half">
                            <label for="cvv">CVV</label>
                            <input type="text" id="cvv" name="cvv" 
                                pattern="[0-9]{3,4}" maxlength="4" required>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="address">Teslimat Adresi</label>
                        <textarea id="address" name="address" rows="3" required></textarea>
            </div>
                    
                    <button type="submit" class="submit-payment-btn">
                        Ödemeyi Tamamla
                    </button>
                </form>
            </div>
        `;

        document.body.appendChild(formContainer);

        // Formu kapat
        const closeBtn = formContainer.querySelector('.close-checkout-btn');
        closeBtn.addEventListener('click', () => {
            formContainer.remove();
        });

        // Ödeme formu gönderimi
        const paymentForm = document.getElementById('payment-form');
        paymentForm.addEventListener('submit', processPayment);

        // Kart numarası formatla
        const cardNumberInput = document.getElementById('card-number');
        cardNumberInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            e.target.value = value;
        });

        // Son kullanma tarihi formatla
        const expiryDateInput = document.getElementById('expiry-date');
        expiryDateInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        });

        // CVV sadece rakam
        const cvvInput = document.getElementById('cvv');
        cvvInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // Ödeme işlemi
    async function processPayment(e) {
        e.preventDefault();

        const form = e.target;
        const submitButton = form.querySelector('.submit-payment-btn');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';

        const formData = new FormData(form);

        // CSRF token doğrula
        const formToken = formData.get('_csrf');
        if (formToken !== sessionStorage.getItem('csrfToken')) {
            showMessage('Güvenlik hatası: İşlem doğrulanamadı. Lütfen sayfayı yenileyip tekrar deneyin.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Ödemeyi Tamamla';
            return;
        }

        try {
            // Sipariş oluştur
            const orderData = {
                user_id: currentUser.id,
                total_amount: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                items: cartItems.map(item => ({
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                shipping_address: formData.get('address'),
                created_at: new Date().toISOString(),
                status: 'processing'
            };

            // Siparişi veritabanına kaydet
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select();

            if (orderError) throw orderError;

            // Sahte bir ödeme işlemi simülasyonu (gerçek uygulamada ödeme ağ geçidi API'si)
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Sepeti temizle
            clearCart();

            // Ödeme formunu kapat
            document.getElementById('checkout-form-container').remove();

            // Başarı mesajı göster
            showMessage('Siparişiniz başarıyla alındı! Teşekkür ederiz.', 'success');

            // Sipariş detay sayfasına yönlendir
            setTimeout(() => {
                window.location.href = `order-confirmation.html?order_id=${order[0].id}`;
            }, 2000);

        } catch (error) {
            console.error('Ödeme işlemi sırasında hata:', error);
            showMessage('Ödeme işlemi sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.', 'error');

            submitButton.disabled = false;
            submitButton.textContent = 'Ödemeyi Tamamla';
        }
    }

    // Sepete ürün ekle
    function addToCart(product) {
        // Ürün zaten sepette var mı kontrol et
        const existingItem = cartItems.find(item => item.id === product.id);

        if (existingItem) {
            // Varsa miktarını artır
            existingItem.quantity += 1;
        } else {
            // Yoksa yeni ekle
            cartItems.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                image: product.image_url,
                quantity: 1
            });
        }

        // Sepeti güncelle
        updateCart();

        // Kullanıcı giriş yapmışsa sepeti kaydet
        if (currentUser) {
            saveCart(currentUser.id);
        }

        // Animasyonlu bildirim göster
        showMessage(`${sanitizeInput(product.name)} sepete eklendi.`, 'success');
    }

    // Sepeti güncelle
    function updateCart() {
        if (!cartItemsList) return;

        cartItemsList.innerHTML = '';

        if (cartItems.length === 0) {
            cartItemsList.innerHTML = '<li class="empty-cart">Sepetiniz boş</li>';
            cartTotal.textContent = '0.00 ₺';
            cartBadge.textContent = '0';
            cartBadge.style.display = 'none';

            if (checkoutButton) {
                checkoutButton.disabled = true;
            }
            return;
        }

        let total = 0;
        let totalItems = 0;

        cartItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            totalItems += item.quantity;

            const cartItem = document.createElement('li');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-image">
                    <img src="${sanitizeInput(item.image)}" alt="${sanitizeInput(item.name)}"
                        onerror="this.src='images/product-placeholder.jpg'">
                </div>
                <div class="cart-item-details">
                    <h4>${sanitizeInput(item.name)}</h4>
                    <div class="cart-item-price-qty">
                        <span>${item.price.toFixed(2)} ₺</span>
                        <div class="quantity-control">
                            <button class="decrease-qty" data-product-id="${item.id}">-</button>
                            <span>${item.quantity}</span>
                            <button class="increase-qty" data-product-id="${item.id}">+</button>
                        </div>
                    </div>
                </div>
                <button class="remove-item-btn" data-product-id="${item.id}">
                    <i class="fas fa-trash"></i>
                </button>
            `;

            cartItemsList.appendChild(cartItem);

            // Miktar azaltma butonu
            const decreaseBtn = cartItem.querySelector('.decrease-qty');
            decreaseBtn.addEventListener('click', () => {
                decreaseQuantity(item.id);
            });

            // Miktar artırma butonu
            const increaseBtn = cartItem.querySelector('.increase-qty');
            increaseBtn.addEventListener('click', () => {
                increaseQuantity(item.id);
            });

            // Ürünü kaldırma butonu
            const removeBtn = cartItem.querySelector('.remove-item-btn');
            removeBtn.addEventListener('click', () => {
                removeFromCart(item.id);
            });
        });

        cartTotal.textContent = `${total.toFixed(2)} ₺`;
        cartBadge.textContent = totalItems.toString();
        cartBadge.style.display = 'block';

        if (checkoutButton) {
            checkoutButton.disabled = false;
        }
    }

    // Ürün miktarını azalt
    function decreaseQuantity(productId) {
        const item = cartItems.find(item => item.id === productId);

        if (item && item.quantity > 1) {
            item.quantity -= 1;
            updateCart();

            // Kullanıcı giriş yapmışsa sepeti kaydet
            if (currentUser) {
                saveCart(currentUser.id);
            }
        }
    }

    // Ürün miktarını artır
    function increaseQuantity(productId) {
        const item = cartItems.find(item => item.id === productId);

        if (item) {
            item.quantity += 1;
            updateCart();

            // Kullanıcı giriş yapmışsa sepeti kaydet
            if (currentUser) {
                saveCart(currentUser.id);
            }
        }
    }

    // Ürünü sepetten kaldır
    function removeFromCart(productId) {
        cartItems = cartItems.filter(item => item.id !== productId);
        updateCart();

        // Kullanıcı giriş yapmışsa sepeti kaydet
        if (currentUser) {
            saveCart(currentUser.id);
        }
    }

    // Sepeti tamamen temizle
    function clearCart() {
        cartItems = [];
        updateCart();

        // Kullanıcı giriş yapmışsa sepeti kaydet
        if (currentUser) {
            saveCart(currentUser.id);
        }
    }

    // Sepeti veritabanına kaydet
    async function saveCart(userId) {
        try {
            const { error } = await supabase
                .from('shopping_carts')
                .upsert({
                    user_id: userId,
                    items: cartItems,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

        } catch (error) {
            console.error('Sepet kaydedilirken hata:', error);
        }
    }

    // Kaydedilmiş sepeti yükle
    async function loadSavedCart(userId) {
        try {
            const { data, error } = await supabase
                .from('shopping_carts')
                .select('items')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data && data.items) {
                cartItems = data.items;
                updateCart();
            }

        } catch (error) {
            console.error('Sepet yüklenirken hata:', error);
        }
    }

    // Mesaj gösterme fonksiyonu
    function showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('message-container') || createMessageContainer();

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.innerHTML = sanitizeInput(message);

        messageContainer.appendChild(messageElement);

        // 3 saniye sonra mesajı kaldır
        setTimeout(() => {
            messageElement.classList.add('hide');
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }, 3000);
    }

    // Mesaj container oluştur
    function createMessageContainer() {
        const container = document.createElement('div');
        container.id = 'message-container';
        container.className = 'message-container';
        document.body.appendChild(container);
        return container;
    }

    // HTML sanitizasyonu
    function sanitizeInput(input) {
        if (!input) return '';

        const element = document.createElement('div');
        element.textContent = input;
        return element.innerHTML;
    }
});