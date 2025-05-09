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
    const settingsCategories = document.querySelectorAll('.settings-sidebar .settings-menu-item');
    const settingsSections = document.querySelectorAll('.settings-main-content .settings-section');

    // Sayfa yüklendiğinde varsayılan kategoriyi aktif et ve göster
    function initializeSettingsPage() {
        // İlk kategoriyi (Hesabım) aktif et ve ilgili bölümü göster
        const defaultCategory = document.querySelector('.settings-menu-item[data-target="account-settings"]');
        const defaultSection = document.getElementById('account-settings');

        if (defaultCategory && defaultSection) {
            settingsCategories.forEach(cat => cat.classList.remove('active'));
            settingsSections.forEach(sec => sec.classList.remove('active')); // Önce tüm active'leri kaldır

            defaultCategory.classList.add('active');
            defaultSection.classList.add('active'); // 'hidden' yerine 'active' kullanıyoruz
        } else {
            console.error('Varsayılan ayar kategorisi veya bölümü bulunamadı!');
        }
    }

    // Eksik olabilecek CSS stillerini dinamik olarak ekleyen fonksiyon (Artık gerekli değil, CSS'e eklendi)
    // function addSettingStyles() { ... }

    // Sayfa yüklendiğinde ayarları başlat
    initializeSettingsPage();

    settingsCategories.forEach(category => {
        category.addEventListener('click', function () {
            const targetId = this.dataset.target;
            const targetSection = document.getElementById(targetId);

            // Çıkış Yap butonu özel işlemi
            if (this.id === 'logoutButton') {
                // Burada gerçek çıkış işlemi yapılmalı (örneğin Supabase ile)
                showNotification('Çıkış yapılıyor...', 'info'); // Kullanıcıya bilgi ver
                setTimeout(() => {
                    // Örnek: supabase.auth.signOut();
                    window.location.href = 'login.html'; // Giriş sayfasına yönlendir
                }, 1500);
                return;
            }

            if (targetSection) {
                // Aktif kategoriyi güncelle
                settingsCategories.forEach(cat => cat.classList.remove('active'));
                this.classList.add('active');

                // Aktif bölümü animasyonla değiştir
                const currentActiveSection = document.querySelector('.settings-section.active');
                if (currentActiveSection && currentActiveSection !== targetSection) {
                    currentActiveSection.classList.remove('active'); // Önce mevcutu gizle (animasyon için)
                }

                // Kısa bir gecikmeyle yenisini göster (CSS animasyonunun çalışması için)
                setTimeout(() => {
                    targetSection.classList.add('active');
                }, 50);

            } else {
                console.warn(`Hedef bölüm bulunamadı: ${targetId}`);
                // İsteğe bağlı: Kullanıcıya bölümün bulunamadığına dair bir mesaj gösterilebilir
            }
        });
    });


    // Form alanlarına animasyon ekle (Bu kısım genel UI etkileşimleri için kalabilir)
    const formElements = document.querySelectorAll('.settings-form .input-group input, .settings-form .input-group textarea'); // Selectör güncellendi
    formElements.forEach((element) => { // index kaldırıldı, kullanılmıyor
        // Odaklanma ve bulanıklaştırma olayları için input-group'a class ekleyip kaldırma
        const inputGroup = element.closest('.input-group');
        if (inputGroup) {
            element.addEventListener('focus', function () {
                inputGroup.classList.add('focused');
            });
            element.addEventListener('blur', function () {
                inputGroup.classList.remove('focused');
            });
        }
    });

    // Butonlara hover animasyonları için class ekleme (CSS'te :hover ile yapılabilir, JS gereksiz)
    // const allButtons = document.querySelectorAll('.settings-button, .settings-button-danger'); // .cancel-button eklenebilir
    // allButtons.forEach(button => {
    //     button.addEventListener('mouseenter', function () {
    //         this.classList.add('hover-effect');
    //     });
    //     button.addEventListener('mouseleave', function () {
    //         this.classList.remove('hover-effect');
    //     });
    // });

    // Aşağıdaki UI etkileşimleri için HTML'de karşılıkları olmadığından kaldırıldı veya yorumlandı:
    // initializeThemeCards();
    // initializeColorItems();
    // initializeSaveButton(); // Form submit ile ele alınacak
    // initializeCancelButton(); // Gerekirse eklenebilir
    // initializeDangerButton(); // Form submit ile ele alınacak
    // initializeFontSizeSlider();
    // initializeSearchInput(); // settings-sidebar-search için ayrı bir mantık var
    // initializeAnimationSettings();
    // initializeFontSelector();
    // initializePasswordSettings(); // Şifre değiştirme formu submit ile ele alınacak
    // initializeSecuritySettings(); // Güvenlik ayarları formu submit ile ele alınacak
    // initializeKeyboardShortcuts(); // HTML'de bu bölüm yok
    // initializeLanguageSettings(); // HTML'de bu bölüm yok

    // Bildirim gösterme fonksiyonu (Global olarak kullanılabilir)
    window.showNotification = function (message, type = 'info') {
        const container = document.getElementById('notification-container') || createNotificationContainer();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;

        const iconClass = getIconForType(type);

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="notification-content">
                ${sanitizeInput(message)}
            </div>
            <div class="notification-close">
                <i class="fas fa-times"></i>
            </div>
        `;

        container.appendChild(notification);

        // Kapatma butonu işlevselliği
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        });

        // Gösterme animasyonu
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Otomatik gizleme ve kaldırma
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                // Eğer hala DOM'daysa kaldır
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300); // CSS transition süresiyle eşleşmeli
        }, 5000); // 5 saniye sonra gizle
    }

    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        // Stilleri CSS dosyasından alınacak, burada temel pozisyonlama
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '100000'; // Diğer her şeyin üzerinde
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
        return container;
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

    // Diğer UI etkileşimleri (artık HTML'de karşılıkları olmadığı için kaldırıldı veya yorumlandı)
    // initializeThemeCards();
    // initializeColorItems();
    // initializeFontSizeSlider();
    // initializeAnimationSettings();
    // initializeFontSelector();
    // initializePasswordSettings(); // Şifre değiştirme formu submit ile ele alınacak
    // initializeSecuritySettings(); // Güvenlik ayarları formu submit ile ele alınacak
    // initializeKeyboardShortcuts(); // HTML'de bu bölüm yok
    // initializeLanguageSettings(); // HTML'de bu bölüm yok
    // initializeNotificationSettings(); // Bu da artık global showNotification ile yönetiliyor
    // initializeAudioVideoSettings(); // Bu da artık global showNotification ile yönetiliyor
});
