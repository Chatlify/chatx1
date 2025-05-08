import { supabase } from './auth_config.js';

// Settings page JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    // CSRF token oluştur ve sakla
    const csrfToken = generateCSRFToken();
    sessionStorage.setItem('csrfToken', csrfToken);

    // Form elementlerini seç
    const userSettingsForm = document.getElementById('userSettingsForm');
    const securitySettingsForm = document.getElementById('securitySettingsForm');
    const notificationSettingsForm = document.getElementById('notificationSettingsForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // CSRF token gizli alanlarını formlara ekle
    addCSRFTokenToForms();

    // Kullanıcı oturumunu kontrol et
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // Mevcut kullanıcı bilgilerini yükle
    await loadUserProfile();

    // Form dinleyicileri ekle
    if (userSettingsForm) {
        userSettingsForm.addEventListener('submit', handleUserSettingsSubmit);
    }

    if (securitySettingsForm) {
        securitySettingsForm.addEventListener('submit', handleSecuritySettingsSubmit);
    }

    if (notificationSettingsForm) {
        notificationSettingsForm.addEventListener('submit', handleNotificationSettingsSubmit);
    }

    // CSRF token oluşturma fonksiyonu
    function generateCSRFToken() {
        const randomBytes = new Uint8Array(16);
        window.crypto.getRandomValues(randomBytes);
        return Array.from(randomBytes)
            .map(byte => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    // Formlara CSRF token ekle
    function addCSRFTokenToForms() {
        const forms = [userSettingsForm, securitySettingsForm, notificationSettingsForm];

        forms.forEach(form => {
            if (!form) return;

            const existingTokenField = form.querySelector('input[name="_csrf"]');
            if (existingTokenField) {
                existingTokenField.value = csrfToken;
                return;
            }

            const csrfField = document.createElement('input');
            csrfField.type = 'hidden';
            csrfField.name = '_csrf';
            csrfField.value = csrfToken;
            form.appendChild(csrfField);
        });
    }

    // CSRF token doğrulama
    function validateCSRFToken(formToken) {
        const storedToken = sessionStorage.getItem('csrfToken');
        return formToken === storedToken;
    }

    // Kullanıcı profil bilgilerini yükle
    async function loadUserProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('Kullanıcı bulunamadı');
            }

            // Profil detaylarını veritabanından çek
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            // Form alanlarını doldur
            if (usernameInput) {
                usernameInput.value = profile.username || user.user_metadata?.username || '';
            }

            if (emailInput) {
                emailInput.value = user.email || '';
            }

            // Bildirim ayarlarını doldur
            if (notificationSettingsForm) {
                const emailNotifs = document.getElementById('emailNotifications');
                const pushNotifs = document.getElementById('pushNotifications');

                if (emailNotifs) {
                    emailNotifs.checked = profile.email_notifications || false;
                }

                if (pushNotifs) {
                    pushNotifs.checked = profile.push_notifications || false;
                }
            }

        } catch (error) {
            console.error('Profil yükleme hatası:', error);
            showErrorMessage('Profil bilgileri yüklenemedi. Lütfen daha sonra tekrar deneyin.');
        }
    }

    // Kullanıcı ayarları formu işleme
    async function handleUserSettingsSubmit(e) {
        e.preventDefault();

        // CSRF token doğrula
        const formData = new FormData(userSettingsForm);
        const formToken = formData.get('_csrf');

        if (!validateCSRFToken(formToken)) {
            showErrorMessage('Güvenlik hatası: Oturumunuz doğrulanamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        const username = sanitizeInput(usernameInput.value.trim());

        // Form doğrulama
        if (username.length < 3) {
            showInputError(usernameInput, 'Kullanıcı adı en az 3 karakter olmalıdır.');
            return;
        }

        try {
            // Yükleme durumunu göster
            showLoading(userSettingsForm, true);

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('Kullanıcı bulunamadı');
            }

            // Kullanıcı metadatasını güncelle
            const { error: metadataError } = await supabase.auth.updateUser({
                data: { username }
            });

            if (metadataError) throw metadataError;

            // Profil tablosunu güncelle
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ username })
                .eq('id', user.id);

            if (profileError) throw profileError;

            showSuccessMessage('Kullanıcı bilgileri başarıyla güncellendi.');

        } catch (error) {
            console.error('Kullanıcı ayarları güncelleme hatası:', error);
            showErrorMessage(`Ayarlar güncellenirken bir hata oluştu: ${error.message}`);
        } finally {
            showLoading(userSettingsForm, false);
        }
    }

    // Güvenlik ayarları formu işleme
    async function handleSecuritySettingsSubmit(e) {
        e.preventDefault();

        // CSRF token doğrula
        const formData = new FormData(securitySettingsForm);
        const formToken = formData.get('_csrf');

        if (!validateCSRFToken(formToken)) {
            showErrorMessage('Güvenlik hatası: Oturumunuz doğrulanamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        const currentPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Form doğrulama
        if (!currentPassword) {
            showInputError(currentPasswordInput, 'Mevcut şifrenizi girmelisiniz.');
            return;
        }

        if (newPassword.length < 8) {
            showInputError(newPasswordInput, 'Yeni şifre en az 8 karakter olmalıdır.');
            return;
        }

        if (newPassword !== confirmPassword) {
            showInputError(confirmPasswordInput, 'Şifreler eşleşmiyor.');
            return;
        }

        try {
            // Yükleme durumunu göster
            showLoading(securitySettingsForm, true);

            // Mevcut şifreyi doğrula
            const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
                email: emailInput.value,
                password: currentPassword
            });

            if (signInError) {
                showInputError(currentPasswordInput, 'Mevcut şifre yanlış.');
                throw signInError;
            }

            // Şifreyi güncelle
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            // Formu temizle
            securitySettingsForm.reset();

            showSuccessMessage('Şifreniz başarıyla güncellendi.');

        } catch (error) {
            console.error('Şifre güncelleme hatası:', error);
            if (!error.message.includes('password')) {
                showErrorMessage(`Şifre güncellenirken bir hata oluştu: ${error.message}`);
            }
        } finally {
            showLoading(securitySettingsForm, false);
        }
    }

    // Bildirim ayarları formu işleme
    async function handleNotificationSettingsSubmit(e) {
        e.preventDefault();

        // CSRF token doğrula
        const formData = new FormData(notificationSettingsForm);
        const formToken = formData.get('_csrf');

        if (!validateCSRFToken(formToken)) {
            showErrorMessage('Güvenlik hatası: Oturumunuz doğrulanamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
            return;
        }

        const emailNotifs = document.getElementById('emailNotifications').checked;
        const pushNotifs = document.getElementById('pushNotifications').checked;

        try {
            // Yükleme durumunu göster
            showLoading(notificationSettingsForm, true);

            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('Kullanıcı bulunamadı');
            }

            // Bildirim ayarlarını güncelle
            const { error } = await supabase
                .from('profiles')
                .update({
                    email_notifications: emailNotifs,
                    push_notifications: pushNotifs
                })
                .eq('id', user.id);

            if (error) throw error;

            showSuccessMessage('Bildirim ayarları başarıyla güncellendi.');

        } catch (error) {
            console.error('Bildirim ayarları güncelleme hatası:', error);
            showErrorMessage(`Bildirim ayarları güncellenirken bir hata oluştu: ${error.message}`);
        } finally {
            showLoading(notificationSettingsForm, false);
        }
    }

    // Yardımcı fonksiyonlar
    function showLoading(form, isLoading) {
        const submitBtn = form.querySelector('button[type="submit"]');

        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Kaydet';
        }
    }

    function showSuccessMessage(message) {
        const messageContainer = document.getElementById('settingsMessages') || createMessageContainer();
        messageContainer.innerHTML = `<div class="alert alert-success">${sanitizeInput(message)}</div>`;
        messageContainer.style.display = 'block';

        // 5 saniye sonra mesajı gizle
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 5000);
    }

    function showErrorMessage(message) {
        const messageContainer = document.getElementById('settingsMessages') || createMessageContainer();
        messageContainer.innerHTML = `<div class="alert alert-danger">${sanitizeInput(message)}</div>`;
        messageContainer.style.display = 'block';
    }

    function createMessageContainer() {
        const container = document.createElement('div');
        container.id = 'settingsMessages';
        container.className = 'message-container';
        document.querySelector('.settings-container').prepend(container);
        return container;
    }

    function showInputError(input, message) {
        const formGroup = input.closest('.form-group');
        const errorElement = formGroup.querySelector('.error-message') || document.createElement('div');

        if (!errorElement.classList.contains('error-message')) {
            errorElement.className = 'error-message';
            formGroup.appendChild(errorElement);
        }

        errorElement.textContent = message;
        input.classList.add('error');
    }

    function sanitizeInput(input) {
        if (!input) return '';

        const element = document.createElement('div');
        element.textContent = input;
        return element.innerHTML;
    }

    // Sayfa yüklendiğinde animasyonlar için sınıfları ekle
    document.body.classList.add('page-loaded');

    // Kapatma butonuna tıklama
    const closeButton = document.querySelector('.settings-close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', function (e) {
            e.preventDefault();

            // Geçiş animasyonu
            document.body.classList.add('page-transition');

            // Kısa bir gecikme sonra yönlendirme yap
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 300);
        });
    }

    // Ayar kategorilerini işlevsel hale getirme
    const settingsCategories = document.querySelectorAll('.settings-category');
    const settingsSections = document.querySelectorAll('.settings-section');

    // Sayfa yüklendiğinde ayarlar bölümlerini oluştur
    createSettingPanels();

    // Sayfa yüklendiğinde varsayılan kategoriyi aktif et ve göster
    function initializeSettingsPage() {
        console.log('Ayarlar sayfası başlatılıyor...');

        // Tüm ayar bölümlerini oluştur (eğer HTML'de yoklarsa)
        createSettingPanels();

        // İlk kategoriyi (Hesabım) aktif et
        const defaultCategory = document.querySelector('.settings-category[data-target="account-settings"]');
        if (defaultCategory) {
            defaultCategory.classList.add('active');
            console.log('Varsayılan kategori aktif edildi:', defaultCategory.getAttribute('data-target'));
        } else {
            console.error('Varsayılan kategori bulunamadı!');
        }

        // Hesap ayarları bölümünü göster, diğerlerini gizle
        settingsSections.forEach(section => {
            if (section.id === 'account-settings') {
                section.classList.remove('hidden');
                console.log('Gösterilen bölüm:', section.id);
            } else {
                section.classList.add('hidden');
                console.log('Gizlenen bölüm:', section.id);
            }
        });

        // CSS sınıflarını stillerde tanımla
        addSettingStyles();

        console.log('Mevcut ayar bölümleri:', [...settingsSections].map(s => s.id).join(', '));
    }

    // Eksik ayar bölümlerini oluştur
    function createSettingPanels() {
        console.log('Ayar bölümleri oluşturuluyor...');

        // Tüm kategorileri al
        const categories = document.querySelectorAll('.settings-category');
        const settingsContent = document.querySelector('.settings-content');

        if (!settingsContent) {
            console.error('Ayarlar içerik alanı bulunamadı');
            return;
        }

        // Tüm mevcut panelleri bul
        const existingPanels = {};
        document.querySelectorAll('.settings-section').forEach(panel => {
            existingPanels[panel.id] = true;
            console.log('Mevcut panel bulundu:', panel.id);
        });

        // Her kategori için panel oluştur
        categories.forEach(category => {
            // Çıkış kategorisini atla
            if (category.querySelector('span').textContent === 'Çıkış Yap') {
                return;
            }

            const categoryText = category.querySelector('span').textContent.trim();
            const targetId = category.getAttribute('data-target');

            // Panel ID'si belirle
            const panelId = targetId || categoryText.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, '-and-') + '-settings';

            // Panel zaten varsa oluşturma
            if (existingPanels[panelId]) {
                console.log('Panel zaten var, atlanıyor:', panelId);
                return;
            }

            console.log('Yeni panel oluşturuluyor:', panelId, 'kategorisi için:', categoryText);

            // Yeni panel içeriği oluştur (burada her panel için özel içerik eklenebilir)
            let panelContent = '';

            switch (categoryText) {
                case 'Görünüm':
                    panelContent = `
                        <div class="settings-section-header">
                            <h2>Görünüm</h2>
                            <p>Arayüz görünümünü ve tema ayarlarınızı özelleştirin</p>
                        </div>
                        <div class="appearance-settings-content">
                            <div class="appearance-section">
                                <h3>Tema Seçimi</h3>
                                <div class="theme-cards">
                                    <div class="theme-card active">
                                        <div class="theme-preview dark"></div>
                                        <div class="theme-name">Koyu Tema</div>
                                    </div>
                                    <div class="theme-card">
                                        <div class="theme-preview light"></div>
                                        <div class="theme-name">Açık Tema</div>
                                    </div>
                                    <div class="theme-card">
                                        <div class="theme-preview amoled"></div>
                                        <div class="theme-name">AMOLED</div>
                                    </div>
                                    <div class="theme-card">
                                        <div class="theme-preview custom"></div>
                                        <div class="theme-name">Özel Tema</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="appearance-section">
                                <h3>Renk Paleti</h3>
                                <div class="color-palette">
                                    <div class="color-item active" style="--accent-color: #7289da;"></div>
                                    <div class="color-item" style="--accent-color: #43b581;"></div>
                                    <div class="color-item" style="--accent-color: #faabdd;"></div>
                                    <div class="color-item" style="--accent-color: #faa61a;"></div>
                                    <div class="color-item" style="--accent-color: #ed4245;"></div>
                                    <div class="color-item custom">+</div>
                                </div>
                            </div>
                            
                            <div class="appearance-option-group">
                                <h3>Yazı Tipi</h3>
                                <div class="setting-row">
                                    <label for="fontSelect">Yazı Tipi Ailesi</label>
                                    <select id="fontSelect" class="settings-select">
                                        <option value="Poppins, sans-serif" selected>Poppins</option>
                                        <option value="Roboto, sans-serif">Roboto</option>
                                        <option value="Open Sans, sans-serif">Open Sans</option>
                                        <option value="Montserrat, sans-serif">Montserrat</option>
                                        <option value="Arial, sans-serif">Arial</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="appearance-option-group">
                                <h3>Yazı Tipi Boyutu</h3>
                                <div class="font-size-slider">
                                    <span class="size-label">A</span>
                                    <input type="range" id="fontSizeSlider" min="12" max="20" value="16">
                                    <span class="size-label">A</span>
                                </div>
                            </div>
                            
                            <div class="appearance-option-group">
                                <h3>Animasyonlar</h3>
                                <div class="setting-row">
                                    <div class="setting-label">Animasyonları Etkinleştir</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            
                            <div class="appearance-option-group">
                                <h3>Arka Plan</h3>
                                <div class="setting-row">
                                    <div class="setting-label">Arka Plan Animasyonu</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            
                            <div class="settings-form-actions">
                                <button class="cancel-button">İptal</button>
                                <button class="save-button">Değişiklikleri Kaydet</button>
                            </div>
                        </div>
                    `;
                    break;

                case 'Bildirimler':
                    panelContent = `
                        <div class="settings-section-header">
                            <h2>Bildirimler</h2>
                            <p>Bildirim tercihlerinizi ve rahatsız etme modunu ayarlayın</p>
                        </div>
                        <div class="notification-settings-content">
                            <div class="notification-option-group">
                                <div class="notification-option">
                                    <div class="option-title">Tüm Bildirimleri Etkinleştir</div>
                                    <div class="option-description">Ana açma/kapama düğmesi</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" class="master-notification-toggle" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                
                                <div class="notification-option">
                                    <div class="option-title">Mesaj Bildirimleri</div>
                                    <div class="option-description">Yeni mesaj aldığınızda bildirim alın</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                
                                <div class="notification-option">
                                    <div class="option-title">Ses Bildirimleri</div>
                                    <div class="option-description">Yeni bildirimleriniz için ses çal</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                
                                <div class="notification-option">
                                    <div class="option-title">Masa üstü Bildirimleri</div>
                                    <div class="option-description">Uygulama arka plandayken bildirim alın</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" checked>
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                
                                <div class="notification-option">
                                    <div class="option-title">E-posta Bildirimleri</div>
                                    <div class="option-description">Önemli bildirimler için e-posta alın</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            
                            <div class="notification-option-group">
                                <h3>Rahatsız Etmeyin Modu</h3>
                                <div class="notification-option">
                                    <div class="option-title">Rahatsız Etme Modu</div>
                                    <div class="option-description">Belirtilen saatler arasında tüm bildirimleri sessize al</div>
                                    <label class="toggle-switch">
                                        <input type="checkbox" id="dnd-toggle">
                                        <span class="toggle-slider"></span>
                                    </label>
                                </div>
                                
                                <div class="dnd-times">
                                    <div class="time-input">
                                        <label>Başlangıç</label>
                                        <input type="time" id="dnd-start-time" value="22:00" disabled>
                                    </div>
                                    <div class="time-input">
                                        <label>Bitiş</label>
                                        <input type="time" id="dnd-end-time" value="08:00" disabled>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="settings-form-actions">
                                <button class="cancel-button">İptal</button>
                                <button class="save-button">Değişiklikleri Kaydet</button>
                            </div>
                        </div>
                    `;
                    break;

                case 'Ses & Video':
                    panelContent = `
                        <div class="settings-section-header">
                            <h2>Ses & Video</h2>
                            <p>Ses ve video görüşmelerini özelleştirin</p>
                        </div>
                        <div class="audio-video-settings-content">
                            <div class="device-settings">
                                <h3>Cihaz Seçimi</h3>
                                
                                <div class="device-selector">
                                    <label>Ses Çıkış Cihazı</label>
                                    <select>
                                        <option selected>Varsayılan - Hoparlör (Realtek HD Audio)</option>
                                        <option>Kulaklık (Realtek HD Audio)</option>
                                        <option>Bluetooth Kulaklık</option>
                                    </select>
                                </div>
                                
                                <div class="device-selector">
                                    <label>Mikrofon</label>
                                    <select>
                                        <option selected>Varsayılan - Mikrofon (Realtek HD Audio)</option>
                                        <option>Harici Mikrofon (USB)</option>
                                        <option>Bluetooth Mikrofon</option>
                                    </select>
                                </div>
                                
                                <div class="device-selector">
                                    <label>Kamera</label>
                                    <select>
                                        <option selected>Varsayılan - Dahili Kamera</option>
                                        <option>USB Webcam</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="volume-settings">
                                <h3>Ses Ayarları</h3>
                                
                                <div class="volume-slider">
                                    <i class="fas fa-volume-up"></i>
                                    <input type="range" id="output-volume" min="0" max="100" value="80">
                                    <span class="volume-value">80%</span>
                                </div>
                                
                                <div class="volume-slider">
                                    <i class="fas fa-microphone-alt"></i>
                                    <input type="range" id="input-volume" min="0" max="100" value="70">
                                    <span class="volume-value">70%</span>
                                </div>
                                
                                <div class="mic-test">
                                    <button class="test-mic-btn">Mikrofonu Test Et</button>
                                    <div class="mic-meter">
                                        <div class="meter-fill"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="video-settings">
                                <h3>Kamera Ayarları</h3>
                                
                                <div class="video-preview">
                                    <div class="video-placeholder">
                                        <i class="fas fa-video-slash"></i>
                                        <span>Kamera kapalı</span>
                                    </div>
                                    <div class="video-controls">
                                        <button class="enable-video"><i class="fas fa-video"></i><span>Kamerayı Etkinleştir</span></button>
                                        <button class="test-video" disabled><i class="fas fa-check-circle"></i><span>Test Et</span></button>
                                    </div>
                                </div>
                                
                                <div class="advanced-video-settings">
                                    <h4>Gelişmiş Ayarlar</h4>
                                    
                                    <div class="advanced-option">
                                        <div class="option-title">Oto Parlaklık</div>
                                        <div class="option-description">Kamera parlaklığını otomatik ayarla</div>
                                        <label class="toggle-switch">
                                            <input type="checkbox" checked>
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    
                                    <div class="advanced-option">
                                        <div class="option-title">Düşük Işık Modu</div>
                                        <div class="option-description">Düşük ışık koşullarında görüntüyü iyileştir</div>
                                        <label class="toggle-switch">
                                            <input type="checkbox">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                    
                                    <div class="advanced-option">
                                        <div class="option-title">Arka Plan Bulanıklaştırma</div>
                                        <div class="option-description">Video görüşmelerinde arka planı bulanıklaştır</div>
                                        <label class="toggle-switch">
                                            <input type="checkbox">
                                            <span class="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="settings-form-actions">
                                <button class="cancel-button">İptal</button>
                                <button class="save-button">Değişiklikleri Kaydet</button>
                            </div>
                        </div>
                    `;
                    break;

                default:
                    // Varsayılan "Geliştirme aşamasında" içeriği
                    panelContent = `
                        <div class="settings-section-header">
                            <h2>${categoryText}</h2>
                            <p>Bu bölüm geliştirilme aşamasındadır</p>
                        </div>
                        <div class="settings-content-placeholder">
                            <i class="fas fa-tools"></i>
                            <h3>Yapım Aşamasında</h3>
                            <p>Bu bölüm şu anda geliştiriliyor ve yakında kullanıma sunulacak.</p>
                        </div>
                    `;
            }

            // Yeni panel oluştur
            const newPanel = document.createElement('div');
            newPanel.id = panelId;
            newPanel.className = 'settings-section hidden';
            newPanel.innerHTML = panelContent;

            // Paneli sayfaya ekle
            settingsContent.appendChild(newPanel);
            console.log('Yeni panel eklendi:', panelId);
        });
    }

    // Eksik olabilecek CSS stillerini dinamik olarak ekleyen fonksiyon
    function addSettingStyles() {
        // Stil zaten eklenmişse tekrar ekleme
        if (document.getElementById('setting-transition-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'setting-transition-styles';
        styleElement.textContent = `
            .settings-section {
                opacity: 1;
                transition: opacity 0.3s ease;
            }
            .settings-section.hidden {
                display: none;
                opacity: 0;
            }
            .settings-section.changing {
                opacity: 0;
            }
            .settings-section.changing-in {
                animation: fadeIn 0.3s ease forwards;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(styleElement);
        console.log('Dinamik CSS stilleri eklendi');
    }

    // Sayfa yüklendiğinde ayarları başlat
    initializeSettingsPage();

    settingsCategories.forEach(category => {
        category.addEventListener('click', function (e) {
            console.log('Kategori tıklandı:', category.querySelector('span').textContent);
            console.log('Data-target değeri:', category.getAttribute('data-target'));

            // Çıkış Yap kategorisini özel olarak işle
            if (category.querySelector('span').textContent === 'Çıkış Yap') {
                showNotification('Çıkış yapılıyor...', 'info');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                return;
            }

            // Aktif kategoriyi güncelle
            const previousActiveCategory = document.querySelector('.settings-category.active');
            if (previousActiveCategory) {
                previousActiveCategory.classList.remove('active');
                console.log('Önceki aktif kategori:', previousActiveCategory.querySelector('span').textContent);
            }

            category.classList.add('active');
            console.log('Yeni aktif kategori:', category.querySelector('span').textContent);

            // Aktif bölümü belirle
            const activeSection = [...settingsSections].find(section => !section.classList.contains('hidden'));
            console.log('Şu anki aktif bölüm:', activeSection ? activeSection.id : 'Yok');

            // Tüm bölümleri gizlemeden önce çıkış animasyonu uygula
            if (activeSection) {
                activeSection.classList.add('changing');
                console.log('Çıkış animasyonu uygulanıyor:', activeSection.id);
            }

            // Data-target özelliğini al
            const targetId = category.getAttribute('data-target');
            console.log('Hedef bölüm ID:', targetId);

            // Tüm bölümleri kontrol et
            console.log('Mevcut tüm bölümler:');
            settingsSections.forEach(section => {
                console.log(`- ${section.id} (${section.classList.contains('hidden') ? 'gizli' : 'görünür'})`);
            });

            setTimeout(() => {
                // Tüm bölümleri gizle
                settingsSections.forEach(section => {
                    section.classList.add('hidden');
                    section.classList.remove('changing');
                });
                console.log('Tüm bölümler gizlendi');

                // ID'ye göre doğrudan bölümü bul
                let targetSection = document.getElementById(targetId);
                console.log('Doğrudan ID araması sonucu:', targetSection ? targetSection.id : 'Bulunamadı');

                // ID bulunamazsa, kategori adına göre bölüm eşleştirme yap
                if (!targetSection) {
                    const categoryText = category.querySelector('span').textContent.trim();
                    console.log('ID bulunamadı, kategori adını kullanıyorum:', categoryText);

                    // HTML ID'lerini kategori adlarına doğrudan eşleştirelim
                    const categoryToId = {
                        'Hesabım': 'account-settings',
                        'Görünüm': 'appearance-settings',
                        'Bildirimler': 'notification-settings',
                        'Gizlilik & Güvenlik': 'privacy-settings',
                        'Güvenlik': 'security-settings',
                        'Ses & Video': 'audio-video-settings',
                        'Klavye Kısayolları': 'keyboard-shortcuts-settings',
                        'Dil & Bölge': 'language-region-settings',
                        'Cihazlar': 'devices-settings',
                        'Geliştirici': 'developer-settings'
                    };

                    // Eşleştirilmiş ID'yi al
                    const mappedId = categoryToId[categoryText];
                    console.log('Eşleştirme sonucu ID:', mappedId);

                    if (mappedId) {
                        targetSection = document.getElementById(mappedId);
                        console.log('Eşleştirilmiş ID araması sonucu:', targetSection ? targetSection.id : 'Bulunamadı');
                    }

                    // Eşleştirme başarısızsa, switch-case'e geri dönelim
                    if (!targetSection) {
                        console.log('Eşleştirme başarısız, switch-case deneniyor');

                        switch (categoryText) {
                            case 'Hesabım':
                                targetSection = document.getElementById('account-settings');
                                break;
                            case 'Görünüm':
                                targetSection = document.getElementById('appearance-settings');
                                break;
                            case 'Bildirimler':
                                targetSection = document.getElementById('notification-settings');
                                break;
                            case 'Gizlilik & Güvenlik':
                                targetSection = document.getElementById('privacy-settings');
                                break;
                            case 'Güvenlik':
                                targetSection = document.getElementById('security-settings');
                                break;
                            case 'Ses & Video':
                                targetSection = document.getElementById('audio-video-settings');
                                break;
                            case 'Klavye Kısayolları':
                                targetSection = document.getElementById('keyboard-shortcuts-settings');
                                break;
                            case 'Dil & Bölge':
                                targetSection = document.getElementById('language-region-settings');
                                break;
                            case 'Cihazlar':
                                targetSection = document.getElementById('devices-settings');
                                break;
                            case 'Geliştirici':
                                targetSection = document.getElementById('developer-settings');
                                break;
                            default:
                                // Varsayılan olarak hesap ayarlarını göster
                                targetSection = document.getElementById('account-settings');
                        }
                    }
                }

                // Hedef bölüm varsa göster
                if (targetSection) {
                    console.log('Bölüm bulundu, gösteriliyor:', targetSection.id);
                    targetSection.classList.remove('hidden');
                    targetSection.classList.add('changing-in');

                    setTimeout(() => {
                        targetSection.classList.remove('changing-in');
                        console.log('Giriş animasyonu tamamlandı');
                    }, 300);
                } else {
                    console.warn(`${targetId || category.querySelector('span').textContent} için bölüm bulunamadı`);
                    showNotification('Bu bölüm henüz mevcut değil', 'warning');

                    // Eksik bölüm oluştur
                    createMissingSection(targetId, category.querySelector('span').textContent);
                }
            }, 300);
        });
    });

    // Eksik bölüm oluşturan fonksiyon
    function createMissingSection(id, title) {
        console.log('Eksik bölüm oluşturuluyor:', id);

        // ID belirtilmemişse kategori adından oluştur
        if (!id) {
            id = title.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, '-and-') + '-settings';
            console.log('Oluşturulan ID:', id);
        }

        // Mevcut bölüm zaten varsa tekrar oluşturma
        if (document.getElementById(id)) {
            console.log('Bu ID ile zaten bir bölüm var, gösteriliyor:', id);
            document.getElementById(id).classList.remove('hidden');
            return;
        }

        // Yeni bölüm oluştur
        const newSection = document.createElement('div');
        newSection.id = id;
        newSection.className = 'settings-section';
        newSection.innerHTML = `
            <div class="settings-section-header">
                <h2>${title}</h2>
                <p>Bu bölüm geliştirilme aşamasındadır</p>
            </div>
            <div class="settings-content-placeholder">
                <i class="fas fa-tools"></i>
                <h3>Yapım Aşamasında</h3>
                <p>Bu bölüm şu anda geliştiriliyor ve yakında kullanıma sunulacak.</p>
            </div>
        `;

        // Yeni bölümü ekle
        document.querySelector('.settings-content').appendChild(newSection);
        console.log('Yeni bölüm oluşturuldu ve eklendi:', id);

        // Bölümü göster
        newSection.classList.remove('hidden');
    }

    // Form alanlarına animasyon ekle
    const formElements = document.querySelectorAll('.settings-form-group input, .settings-form-group textarea, .settings-form-group select');
    formElements.forEach((element, index) => {
        element.addEventListener('focus', function () {
            this.parentElement.classList.add('focused');
        });

        element.addEventListener('blur', function () {
            this.parentElement.classList.remove('focused');
        });
    });

    // Butonlara hover animasyonları ekle
    const allButtons = document.querySelectorAll('.settings-btn, .save-button, .cancel-button, .danger-button');
    allButtons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.classList.add('hover-effect');
        });

        button.addEventListener('mouseleave', function () {
            this.classList.remove('hover-effect');
        });
    });

    // Tema kartları için işlevsellik
    const themeCards = document.querySelectorAll('.theme-card');
    themeCards.forEach(card => {
        card.addEventListener('click', function () {
            const active = document.querySelector('.theme-card.active');
            if (active) active.classList.remove('active');
            card.classList.add('active');

            const themeName = card.querySelector('.theme-name').textContent;
            showNotification(`${themeName} teması seçildi`, 'success');
        });
    });

    // Renk seçiciler için işlevsellik
    const colorItems = document.querySelectorAll('.color-item:not(.custom)');
    colorItems.forEach(item => {
        item.addEventListener('click', function () {
            document.querySelector('.color-item.active').classList.remove('active');
            item.classList.add('active');

            const color = getComputedStyle(item).getPropertyValue('--accent-color');
            showNotification(`Renk değiştirildi: ${color}`, 'success');
        });
    });

    // Özel renk seçici
    const customColorItem = document.querySelector('.color-item.custom');
    if (customColorItem) {
        customColorItem.addEventListener('click', function () {
            // Gerçek uygulamada burada bir renk seçiciyi açabilirsiniz
            showNotification('Özel renk seçici yakında eklenecek', 'info');
        });
    }

    // Kaydet butonları
    const saveButtons = document.querySelectorAll('.save-button');
    saveButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Kaydetme efekti
            this.classList.add('saving');
            setTimeout(() => {
                this.classList.remove('saving');
                showNotification('Ayarlarınız başarıyla kaydedildi', 'success');
            }, 800);
        });
    });

    // İptal butonları
    const cancelButtons = document.querySelectorAll('.cancel-button');
    cancelButtons.forEach(button => {
        button.addEventListener('click', function () {
            showNotification('Değişiklikler iptal edildi', 'info');

            // Form değerlerini sıfırlama (gerçek uygulamada)
            // Burada formları sıfırlama kodu olabilir
        });
    });

    // Tehlikeli alan butonları
    const dangerButtons = document.querySelectorAll('.danger-button');
    dangerButtons.forEach(button => {
        button.addEventListener('click', function () {
            const action = button.textContent.trim();

            // Hesap silme butonu için onay isteyelim
            if (action === 'Hesabı Sil') {
                if (confirm('Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
                    showNotification('Hesap silme işlemi başlatıldı', 'error');
                }
            } else if (action === 'Devre Dışı Bırak') {
                showNotification('Hesabınız devre dışı bırakıldı', 'warning');
            }
        });
    });

    // Yazı tipi boyutu değiştirici
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', function () {
            const fontSize = fontSizeSlider.value;
            document.documentElement.style.fontSize = `${fontSize}px`;
        });
    }

    // Ayarlarda arama
    const settingsSearchInput = document.querySelector('.settings-search input');
    if (settingsSearchInput) {
        settingsSearchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();

            if (searchTerm.length < 2) {
                settingsCategories.forEach(category => {
                    category.style.display = 'flex';
                });
                return;
            }

            settingsCategories.forEach(category => {
                const categoryText = category.querySelector('span').textContent.toLowerCase();

                if (categoryText.includes(searchTerm)) {
                    category.style.display = 'flex';
                } else {
                    category.style.display = 'none';
                }
            });
        });
    }

    // Bildirim gösterme fonksiyonu
    function showNotification(message, type = 'info') {
        // dashboard.js'de tanımlanmış olan aynı fonksiyonu kullanabilmek için
        // o fonksiyon varsa onu kullan, yoksa burada tanımla
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${getIconForType(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Show animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Hide and remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    function getIconForType(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-times-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'info':
            default: return 'fa-info-circle';
        }
    }

    // Animation toggle işlevselliği
    const animationToggle = document.querySelector('.appearance-option-group:nth-of-type(5) input[type="checkbox"]');
    if (animationToggle) {
        animationToggle.addEventListener('change', function () {
            const enableAnimations = this.checked;
            if (enableAnimations) {
                document.body.classList.remove('no-animations');
                showNotification('Animasyonlar etkinleştirildi', 'success');
            } else {
                document.body.classList.add('no-animations');
                showNotification('Animasyonlar devre dışı bırakıldı', 'info');
            }
        });
    }

    // Arka plan animasyonu toggle işlevselliği
    const bgAnimationToggle = document.querySelector('.appearance-option-group:nth-of-type(6) input[type="checkbox"]');
    if (bgAnimationToggle) {
        bgAnimationToggle.addEventListener('change', function () {
            const enableBgAnimation = this.checked;
            const bgAnimation = document.querySelector('.bg-animation');

            if (enableBgAnimation && bgAnimation) {
                bgAnimation.style.display = 'block';
                showNotification('Arka plan animasyonu etkinleştirildi', 'success');
            } else if (bgAnimation) {
                bgAnimation.style.display = 'none';
                showNotification('Arka plan animasyonu devre dışı bırakıldı', 'info');
            }
        });
    }

    // Yazı tipi seçici
    const fontSelect = document.querySelector('.settings-select');
    if (fontSelect) {
        fontSelect.addEventListener('change', function () {
            const selectedFont = this.value;
            document.documentElement.style.fontFamily = selectedFont;
            showNotification(`Yazı tipi ${selectedFont} olarak değiştirildi`, 'success');
        });
    }

    // Dil ve Bölge Bölümü İşlevsellikleri
    document.addEventListener('DOMContentLoaded', function () {
        // Dil ve Bölge bölümü için gerekli elementleri seçme
        const regionItems = document.querySelectorAll('.region-item');
        const languageItems = document.querySelectorAll('.language-item');

        // Bölge öğelerine tıklama işlevselliği ekleme
        regionItems.forEach(item => {
            item.addEventListener('click', function () {
                // Aktif sınıfını tüm öğelerden kaldır
                regionItems.forEach(i => i.classList.remove('active'));
                // Mevcut öğeye aktif sınıfını ekle
                this.classList.add('active');

                // Mevcut göstergesini kaldır
                regionItems.forEach(i => {
                    const indicator = i.querySelector('.current-indicator');
                    if (indicator) {
                        i.removeChild(indicator);
                    }
                });

                // Seçilen öğeye mevcut göstergesini ekle
                const indicator = document.createElement('div');
                indicator.className = 'current-indicator';
                indicator.textContent = 'Mevcut';
                this.appendChild(indicator);

                // Dil değiştiğinde bildirim göster
                showNotification('Bölge değiştirildi: ' + this.querySelector('.region-name').textContent, 'success');
            });
        });

        // Dil öğelerine tıklama işlevselliği ekleme
        languageItems.forEach(item => {
            item.addEventListener('click', function () {
                // Aktif sınıfını tüm öğelerden kaldır
                languageItems.forEach(i => i.classList.remove('active'));
                // Mevcut öğeye aktif sınıfını ekle
                this.classList.add('active');

                // Mevcut göstergesini kaldır
                languageItems.forEach(i => {
                    const indicator = i.querySelector('.current-indicator');
                    if (indicator) {
                        i.removeChild(indicator);
                    }
                });

                // Seçilen öğeye mevcut göstergesini ekle
                const indicator = document.createElement('div');
                indicator.className = 'current-indicator';
                indicator.textContent = 'Mevcut';
                this.appendChild(indicator);

                // Dil değiştiğinde bildirim göster
                const langName = this.querySelector('.language-name').textContent;
                const nativeName = this.querySelector('.language-native').textContent;
                showNotification(`Dil değiştirildi: ${langName} (${nativeName})`, 'success');
            });
        });

        // Dil ve Bölge bölümündeki Değişiklikleri Kaydet butonuna tıklama
        const languageSettings = document.getElementById('language-region-settings');
        if (languageSettings) {
            const saveButton = languageSettings.querySelector('.save-button');
            const cancelButton = languageSettings.querySelector('.cancel-button');

            if (saveButton) {
                saveButton.addEventListener('click', function () {
                    // Normalde buraya seçilen dil ve bölgeyi kaydetme işlevi eklenir
                    // Şimdilik sadece bildirim gösteriyoruz
                    showNotification('Dil ve bölge değişiklikleri başarıyla kaydedildi!', 'success');
                });
            }

            if (cancelButton) {
                cancelButton.addEventListener('click', function () {
                    showNotification('Dil ve bölge değişiklikleri iptal edildi.', 'info');
                });
            }
        }
    });

    // Bildirimler için işlevsellik
    function initializeNotificationSettings() {
        const masterToggle = document.querySelector('.master-notification-toggle');
        const otherToggles = document.querySelectorAll('.notification-option input[type="checkbox"]:not(.master-notification-toggle)');

        if (masterToggle) {
            masterToggle.addEventListener('change', function () {
                const isChecked = this.checked;
                otherToggles.forEach(toggle => {
                    toggle.checked = isChecked;
                    toggle.disabled = !isChecked;
                });

                if (isChecked) {
                    showNotification('Tüm bildirimler etkinleştirildi', 'success');
                } else {
                    showNotification('Tüm bildirimler devre dışı bırakıldı', 'info');
                }
            });
        }

        // Rahatsız Etmeyin modu için zaman seçicileri
        const dndToggle = document.getElementById('dnd-toggle');
        const timeInputs = document.querySelectorAll('.dnd-times input[type="time"]');

        if (dndToggle) {
            dndToggle.addEventListener('change', function () {
                timeInputs.forEach(input => {
                    input.disabled = !this.checked;
                });

                if (this.checked) {
                    const startTime = document.getElementById('dnd-start-time').value;
                    const endTime = document.getElementById('dnd-end-time').value;
                    showNotification(`Rahatsız Etmeyin modu etkinleştirildi: ${startTime} - ${endTime}`, 'success');
                } else {
                    showNotification('Rahatsız Etmeyin modu devre dışı bırakıldı', 'info');
                }
            });
        }

        // Bildirim seçenekleri için tekil işlevsellik
        otherToggles.forEach(toggle => {
            toggle.addEventListener('change', function () {
                const optionName = this.closest('.notification-option').querySelector('.option-title').textContent;
                if (this.checked) {
                    showNotification(`"${optionName}" etkinleştirildi`, 'success');
                } else {
                    showNotification(`"${optionName}" devre dışı bırakıldı`, 'info');
                }

                // Ana toggle'ı kontrol et
                updateMasterToggle();
            });
        });

        function updateMasterToggle() {
            if (!masterToggle) return;

            const allChecked = Array.from(otherToggles).every(toggle => toggle.checked);
            masterToggle.checked = allChecked;
        }
    }

    // Ses ve Video ayarları için işlevsellik
    function initializeAudioVideoSettings() {
        // Ses ve mikrofon kontrollerini başlat
        const outputVolume = document.getElementById('output-volume');
        const inputVolume = document.getElementById('input-volume');
        const outputVolumeValue = document.querySelector('.volume-slider:nth-child(4) .volume-value');
        const inputVolumeValue = document.querySelector('.volume-slider:nth-child(5) .volume-value');
        const testMicBtn = document.querySelector('.test-mic-btn');
        const meterFill = document.querySelector('.meter-fill');

        // Ses ve mikrofon kontrollerini başlat
        if (outputVolume && outputVolumeValue) {
            outputVolume.addEventListener('input', function () {
                const value = this.value;
                outputVolumeValue.textContent = value + '%';

                // İkon değişimi
                const volumeIcon = this.previousElementSibling;
                if (value < 1) {
                    volumeIcon.className = 'fas fa-volume-mute';
                } else if (value < 50) {
                    volumeIcon.className = 'fas fa-volume-down';
                } else {
                    volumeIcon.className = 'fas fa-volume-up';
                }
            });
        }

        if (inputVolume && inputVolumeValue) {
            inputVolume.addEventListener('input', function () {
                const value = this.value;
                inputVolumeValue.textContent = value + '%';

                // Mikrofon seviyesine göre ikon değiştirme
                const micIcon = this.previousElementSibling;
                if (value < 1) {
                    micIcon.className = 'fas fa-microphone-slash';
                } else if (value < 50) {
                    micIcon.className = 'fas fa-microphone-alt-slash';
                } else {
                    micIcon.className = 'fas fa-microphone-alt';
                }
            });
        }

        // Mikrofon testi işlevselliği
        if (testMicBtn && meterFill) {
            testMicBtn.addEventListener('click', function () {
                // Simüle edilmiş mikrofon testi
                showNotification('Mikrofon testi başlatıldı', 'info');

                let level = 0;
                const interval = setInterval(function () {
                    level = Math.min(100, level + Math.random() * 20);
                    meterFill.style.width = level + '%';

                    if (level >= 90) {
                        clearInterval(interval);
                        setTimeout(function () {
                            meterFill.style.width = '0%';
                            showNotification('Mikrofon testi tamamlandı', 'success');
                        }, 1000);
                    }
                }, 100);
            });
        }

        // Video ayarları
        const enableVideoBtn = document.querySelector('.enable-video');
        const testVideoBtn = document.querySelector('.test-video');
        const videoPlaceholder = document.querySelector('.video-placeholder');

        if (enableVideoBtn && testVideoBtn) {
            let videoEnabled = false;

            enableVideoBtn.addEventListener('click', function () {
                videoEnabled = !videoEnabled;

                if (videoEnabled) {
                    // Kamera açma simülasyonu
                    videoPlaceholder.innerHTML = `
                        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #1a2036, #212842); display: flex; align-items: center; justify-content: center;">
                            <div style="width: 150px; height: 150px; border-radius: 50%; background-color: #3d68e7; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-user" style="font-size: 80px; color: white;"></i>
                            </div>
                        </div>
                    `;

                    this.innerHTML = '<i class="fas fa-video-slash"></i><span>Kamerayı Kapat</span>';
                    testVideoBtn.removeAttribute('disabled');
                    showNotification('Kamera etkinleştirildi', 'success');
                } else {
                    // Kamera kapatma simülasyonu
                    videoPlaceholder.innerHTML = `
                        <i class="fas fa-video-slash"></i>
                        <span>Kamera kapalı</span>
                    `;

                    this.innerHTML = '<i class="fas fa-video"></i><span>Kamerayı Etkinleştir</span>';
                    testVideoBtn.setAttribute('disabled', 'disabled');
                    showNotification('Kamera devre dışı bırakıldı', 'info');
                }
            });

            testVideoBtn.addEventListener('click', function () {
                if (!videoEnabled) return;

                showNotification('Video testi başarılı', 'success');
            });
        }

        // Gelişmiş video ayarları
        const videoToggles = document.querySelectorAll('.video-settings .advanced-option input[type="checkbox"]');

        videoToggles.forEach(toggle => {
            toggle.addEventListener('change', function () {
                const optionName = this.closest('.advanced-option').querySelector('.option-title').textContent;
                if (this.checked) {
                    showNotification(`"${optionName}" etkinleştirildi`, 'success');
                } else {
                    showNotification(`"${optionName}" devre dışı bırakıldı`, 'info');
                }
            });
        });

        // Cihaz seçiciler
        const deviceSelectors = document.querySelectorAll('.device-selector select');

        deviceSelectors.forEach(selector => {
            selector.addEventListener('change', function () {
                const deviceType = this.closest('.device-selector').querySelector('label').textContent;
                const selectedDevice = this.options[this.selectedIndex].text;
                showNotification(`${deviceType}: ${selectedDevice} seçildi`, 'success');
            });
        });
    }

    // İşlevsellik başlatma
    initializeSettingsCategories();
    initializeThemeCards();
    initializeColorItems();
    initializeSaveButton();
    initializeCancelButton();
    initializeDangerButton();
    initializeFontSizeSlider();
    initializeSearchInput();
    initializeNotificationSettings();
    initializeAnimationSettings();
    initializeFontSelector();
    initializePasswordSettings();
    initializeSecuritySettings();
    initializeAudioVideoSettings();
    initializeKeyboardShortcuts();
    initializeLanguageSettings();

    // Sayfa yüklendikten sonra tüm işlevleri başlat
    document.addEventListener('DOMContentLoaded', function () {
        // Mevcut işlevler buraya...

        // Yeni işlevler
        initializeNotificationSettings();
        initializeAudioVideoSettings();

        // Şifre görünürlüğü için
        const togglePasswordButtons = document.querySelectorAll('.toggle-password');
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', function () {
                const passwordInput = this.previousElementSibling;
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    passwordInput.type = 'password';
                    this.innerHTML = '<i class="fas fa-eye"></i>';
                }
            });
        });
    });

    // Güvenlik ayarları için işlevsellik
    function initializeSecuritySettings() {
        // Parola görünürlük ayarları
        const togglePasswordBtns = document.querySelectorAll('.toggle-password');
        togglePasswordBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                const passwordInput = this.previousElementSibling;
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    this.classList.remove('fa-eye');
                    this.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    this.classList.remove('fa-eye-slash');
                    this.classList.add('fa-eye');
                }
            });
        });

        // Parola gücü göstergesi
        const newPasswordInput = document.getElementById('new-password');
        const strengthMeter = document.querySelectorAll('.strength-segment');
        const strengthText = document.querySelector('.strength-text');
        const requirements = document.querySelectorAll('.requirement i');

        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', function () {
                const password = this.value;

                // Gereksinimleri kontrol et
                const hasMinLength = password.length >= 8;
                const hasUpperCase = /[A-Z]/.test(password);
                const hasNumber = /[0-9]/.test(password);
                const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

                // Gereksinimleri güncelle
                requirements[0].className = hasMinLength ? 'fas fa-check-circle' : 'fas fa-times-circle';
                requirements[1].className = hasUpperCase ? 'fas fa-check-circle' : 'fas fa-times-circle';
                requirements[2].className = hasNumber ? 'fas fa-check-circle' : 'fas fa-times-circle';
                requirements[3].className = hasSpecialChar ? 'fas fa-check-circle' : 'fas fa-times-circle';

                // Parola gücü puanı
                let strength = 0;
                if (hasMinLength) strength++;
                if (hasUpperCase) strength++;
                if (hasNumber) strength++;
                if (hasSpecialChar) strength++;

                // Güç ölçeği güncelleme
                for (let i = 0; i < 4; i++) {
                    if (i < strength) {
                        strengthMeter[i].classList.add('active');
                    } else {
                        strengthMeter[i].classList.remove('active');
                    }
                }

                // Güç metni güncelleme
                let strengthLabel = '';
                switch (strength) {
                    case 0:
                    case 1:
                        strengthLabel = 'Zayıf';
                        break;
                    case 2:
                        strengthLabel = 'Orta';
                        break;
                    case 3:
                        strengthLabel = 'Güçlü';
                        break;
                    case 4:
                        strengthLabel = 'Çok Güçlü';
                        break;
                }

                if (strengthText) {
                    strengthText.textContent = `Parola Gücü: ${strengthLabel}`;
                }
            });
        }

        // İki faktörlü kimlik doğrulama
        const enable2fa = document.getElementById('enable-2fa');
        const twoFactorSetup = document.querySelector('.two-factor-setup');
        const recoveryCodes = document.querySelector('.recovery-codes');

        if (enable2fa) {
            enable2fa.addEventListener('change', function () {
                if (this.checked) {
                    twoFactorSetup.classList.remove('hidden');
                    showNotification('İki faktörlü kimlik doğrulama kurulumu başlatıldı.', 'info');
                } else {
                    twoFactorSetup.classList.add('hidden');
                    recoveryCodes.classList.add('hidden');
                    showNotification('İki faktörlü kimlik doğrulama devre dışı bırakıldı.', 'warning');
                }
            });
        }

        // Doğrulama butonu
        const verifyButton = document.querySelector('.two-factor-setup .settings-btn.primary');
        if (verifyButton) {
            verifyButton.addEventListener('click', function () {
                const code = document.getElementById('verification-code').value;
                if (code.length === 6 && /^\d+$/.test(code)) {
                    recoveryCodes.classList.remove('hidden');
                    showNotification('İki faktörlü kimlik doğrulama başarıyla etkinleştirildi!', 'success');
                } else {
                    showNotification('Geçersiz doğrulama kodu. 6 haneli sayısal kod giriniz.', 'error');
                }
            });
        }

        // Parola değiştirme butonu
        const changePasswordBtn = document.querySelector('.change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', function () {
                const currentPassword = document.getElementById('current-password').value;
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;

                if (!currentPassword) {
                    showNotification('Lütfen mevcut parolanızı girin.', 'error');
                    return;
                }

                if (!newPassword) {
                    showNotification('Lütfen yeni parolanızı girin.', 'error');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    showNotification('Yeni parolalar eşleşmiyor.', 'error');
                    return;
                }

                // Parola gücü kontrolü
                const hasMinLength = newPassword.length >= 8;
                const hasUpperCase = /[A-Z]/.test(newPassword);
                const hasNumber = /[0-9]/.test(newPassword);
                const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword);

                if (!(hasMinLength && hasUpperCase && hasNumber && hasSpecialChar)) {
                    showNotification('Yeni parolanız güvenlik gereksinimlerini karşılamıyor.', 'error');
                    return;
                }

                // Başarılı değişiklik simülasyonu
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
                showNotification('Parolanız başarıyla değiştirildi!', 'success');
            });
        }

        // Oturum kapatma butonları
        const logoutSessionBtns = document.querySelectorAll('.login-entry .settings-btn.danger.small');
        logoutSessionBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                const loginEntry = this.closest('.login-entry');
                loginEntry.style.opacity = '0.5';
                this.disabled = true;
                this.textContent = 'Kapatıldı';
                showNotification('Uzak oturum başarıyla kapatıldı.', 'success');
            });
        });

        // Tüm oturumları kapatma butonu
        const logoutAllBtn = document.querySelector('.security-section .settings-btn.danger');
        if (logoutAllBtn) {
            logoutAllBtn.addEventListener('click', function () {
                const loginEntries = document.querySelectorAll('.login-entry:not(:first-child)');
                loginEntries.forEach(entry => {
                    entry.style.opacity = '0.5';
                    const btn = entry.querySelector('.settings-btn.danger.small');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Kapatıldı';
                    }
                });
                showNotification('Tüm diğer oturumlar başarıyla kapatıldı.', 'success');
            });
        }
    }

    // Bu fonksiyonlar çağrıldığında hata olmaması için boş tanımlamalar ekle
    function initializeSettingsCategories() {
        console.log('initializeSettingsCategories çağrıldı');
    }
    function initializeThemeCards() {
        console.log('initializeThemeCards çağrıldı');
    }
    function initializeColorItems() {
        console.log('initializeColorItems çağrıldı');
    }
    function initializeSaveButton() {
        console.log('initializeSaveButton çağrıldı');
    }
    function initializeCancelButton() {
        console.log('initializeCancelButton çağrıldı');
    }
    function initializeDangerButton() {
        console.log('initializeDangerButton çağrıldı');
    }
    function initializeFontSizeSlider() {
        console.log('initializeFontSizeSlider çağrıldı');
    }
    function initializeSearchInput() {
        console.log('initializeSearchInput çağrıldı');
    }
    function initializeAnimationSettings() {
        console.log('initializeAnimationSettings çağrıldı');
    }
    function initializeFontSelector() {
        console.log('initializeFontSelector çağrıldı');
    }
    function initializePasswordSettings() {
        console.log('initializePasswordSettings çağrıldı');
    }
    function initializeKeyboardShortcuts() {
        console.log('initializeKeyboardShortcuts çağrıldı');
    }
    function initializeLanguageSettings() {
        console.log('initializeLanguageSettings çağrıldı');
    }
}); 