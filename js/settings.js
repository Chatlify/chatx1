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

    settingsCategories.forEach(category => {
        category.addEventListener('click', function () {
            // Çıkış Yap kategorisini özel olarak işle
            if (category.querySelector('span').textContent === 'Çıkış Yap') {
                showNotification('Çıkış yapılıyor...', 'info');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
                return;
            }

            // Aktif kategoriyi güncelle
            document.querySelector('.settings-category.active').classList.remove('active');
            category.classList.add('active');

            // Aktif bölümü belirle
            let activeSection = null;
            settingsSections.forEach(section => {
                if (!section.classList.contains('hidden')) {
                    activeSection = section;
                }
            });

            // Tüm bölümleri gizlemeden önce çıkış animasyonu uygula
            if (activeSection) {
                activeSection.classList.add('changing');
                setTimeout(() => {
                    // Tüm bölümleri gizle
                    settingsSections.forEach(section => {
                        section.classList.add('hidden');
                        section.classList.remove('changing');
                    });

                    // Data-target özelliğine göre ilgili bölümü göster
                    const targetSection = category.getAttribute('data-target');
                    if (targetSection) {
                        const sectionElement = document.getElementById(targetSection);
                        if (sectionElement) {
                            sectionElement.classList.remove('hidden');
                            sectionElement.classList.add('changing-in');
                            setTimeout(() => {
                                sectionElement.classList.remove('changing-in');
                            }, 300);
                            return;
                        }
                    }

                    // Kategori adına göre bölüm eşleştirme (data-target olmayan durumlar için)
                    const categoryText = category.querySelector('span').textContent;
                    let targetSectionElement;

                    switch (categoryText) {
                        case 'Hesabım':
                            targetSectionElement = document.getElementById('account-settings');
                            break;
                        case 'Görünüm':
                            targetSectionElement = document.getElementById('appearance-settings');
                            break;
                        case 'Dil & Bölge':
                            targetSectionElement = document.getElementById('language-region-settings');
                            break;
                        default:
                            // Henüz oluşturulmamış bölümler için 
                            showNotification(`${categoryText} ayarları yakında eklenecek`, 'warning');
                            targetSectionElement = document.getElementById('account-settings');
                    }

                    if (targetSectionElement) {
                        targetSectionElement.classList.remove('hidden');
                        targetSectionElement.classList.add('changing-in');
                        setTimeout(() => {
                            targetSectionElement.classList.remove('changing-in');
                        }, 300);
                    }
                }, 200);
            } else {
                // Eğer hiçbir aktif bölüm yoksa, direkt yeni bölümü göster
                // Data-target özelliğine göre ilgili bölümü göster
                const targetSection = category.getAttribute('data-target');
                if (targetSection) {
                    const sectionElement = document.getElementById(targetSection);
                    if (sectionElement) {
                        sectionElement.classList.remove('hidden');
                        return;
                    }
                }

                // Kategori adına göre bölüm eşleştirme (data-target olmayan durumlar için)
                const categoryText = category.querySelector('span').textContent;
                switch (categoryText) {
                    case 'Hesabım':
                        document.getElementById('account-settings').classList.remove('hidden');
                        break;
                    case 'Görünüm':
                        document.getElementById('appearance-settings').classList.remove('hidden');
                        break;
                    case 'Dil & Bölge':
                        document.getElementById('language-region-settings').classList.remove('hidden');
                        break;
                    default:
                        // Henüz oluşturulmamış bölümler için 
                        showNotification(`${categoryText} ayarları yakında eklenecek`, 'warning');
                        document.getElementById('account-settings').classList.remove('hidden');
                }
            }
        });
    });

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
            document.querySelector('.theme-card.active').classList.remove('active');
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
}); 