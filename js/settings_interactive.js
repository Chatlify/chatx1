document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.settings-navigation .nav-item');
    const sections = document.querySelectorAll('.settings-content .settings-section');
    const searchInput = document.getElementById('settings-search-input');

    // Başlangıçta doğru bölümü göster
    function showSection(sectionId, pushState = true) {
        sections.forEach(section => {
            section.classList.remove('active');
        });
        navItems.forEach(item => {
            item.classList.remove('active');
        });

        const activeSection = document.getElementById(sectionId);
        const activeNavItem = document.querySelector(`.nav-item[data-section='${sectionId}']`);

        if (activeSection) {
            activeSection.classList.add('active');
        }
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        if (pushState) {
            // URL'ye #sectionId ekle
            history.pushState({ section: sectionId }, `Settings - ${sectionId}`, `#${sectionId}`);
        }
    }

    // URL hash'ine göre başlangıç bölümünü ayarla
    const currentHash = window.location.hash.substring(1);
    if (currentHash) {
        showSection(currentHash, false);
    } else {
        showSection('profile', false); // Varsayılan bölüm
    }

    // Navigasyon tıklamaları
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');
            showSection(sectionId);
        });
    });

    // Tarayıcı geri/ileri butonları için
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.section) {
            showSection(event.state.section, false);
        } else if (!window.location.hash) { // Eğer hash yoksa varsayılana dön
            showSection('profile', false);
        }
    });

    // Arama İşlevselliği (Basit)
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        navItems.forEach(item => {
            const itemText = item.textContent.toLowerCase();
            if (itemText.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // Profil Avatar Yükleme Önizlemesi
    const avatarUpload = document.getElementById('avatar-upload');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    if (avatarUpload && avatarPreview) {
        avatarUpload.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    avatarPreview.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // Tema Seçimi
    const themeOptions = document.querySelectorAll('.theme-option');
    const root = document.documentElement;

    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            themeOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            const selectedTheme = option.getAttribute('data-theme');

            if (selectedTheme === 'light') {
                root.style.setProperty('--background-color', '#F0F2F5');
                root.style.setProperty('--sidebar-background', '#FFFFFF');
                root.style.setProperty('--content-background', '#F8F9FA');
                root.style.setProperty('--card-background', '#FFFFFF');
                root.style.setProperty('--text-color', '#212529');
                root.style.setProperty('--text-color-secondary', '#495057');
                root.style.setProperty('--text-color-muted', '#6C757D');
                root.style.setProperty('--border-color', '#DEE2E6');
                root.style.setProperty('--border-color-light', '#E9ECEF');
                root.style.setProperty('--input-background', '#F8F9FA');
            } else if (selectedTheme === 'dark') {
                root.style.setProperty('--background-color', '#121218');
                root.style.setProperty('--sidebar-background', '#1A1A24');
                root.style.setProperty('--content-background', '#1F1F2A');
                root.style.setProperty('--card-background', '#2A2A38');
                root.style.setProperty('--text-color', '#EAEAEA');
                root.style.setProperty('--text-color-secondary', '#B0B0C0');
                root.style.setProperty('--text-color-muted', '#707080');
                root.style.setProperty('--border-color', '#3A3A4A');
                root.style.setProperty('--border-color-light', '#4A4A5A');
                root.style.setProperty('--input-background', '#333342');
            } else { // Sistem temi için (şimdilik koyu varsayalım, geliştirilebilir)
                // Tarayıcının tercihini algılama eklenebilir.
                root.style.setProperty('--background-color', '#121218');
                root.style.setProperty('--sidebar-background', '#1A1A24');
                root.style.setProperty('--content-background', '#1F1F2A');
                root.style.setProperty('--card-background', '#2A2A38');
                root.style.setProperty('--text-color', '#EAEAEA');
                root.style.setProperty('--text-color-secondary', '#B0B0C0');
                root.style.setProperty('--text-color-muted', '#707080');
                root.style.setProperty('--border-color', '#3A3A4A');
                root.style.setProperty('--border-color-light', '#4A4A5A');
                root.style.setProperty('--input-background', '#333342');
            }
            localStorage.setItem('chatlify-theme', selectedTheme);
        });
    });

    // Kayıtlı temayı yükle
    const savedTheme = localStorage.getItem('chatlify-theme');
    if (savedTheme) {
        document.querySelector(`.theme-option[data-theme='${savedTheme}']`)?.click();
    }

    // Vurgu Rengi
    const accentColorPicker = document.getElementById('accent-color-picker');
    const predefinedColors = document.querySelectorAll('.color-swatch');

    if (accentColorPicker) {
        accentColorPicker.addEventListener('input', (e) => {
            root.style.setProperty('--primary-color', e.target.value);
            root.style.setProperty('--primary-color-dark', chroma(e.target.value).darken(0.6).hex());
            // Diğer elemanlar için de renk güncellenmesi gerekebilir.
            localStorage.setItem('chatlify-accent-color', e.target.value);
            predefinedColors.forEach(sw => sw.classList.remove('active'));
        });
    }

    predefinedColors.forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.getAttribute('data-color');
            root.style.setProperty('--primary-color', color);
            root.style.setProperty('--primary-color-dark', chroma(color).darken(0.6).hex());
            accentColorPicker.value = color;
            localStorage.setItem('chatlify-accent-color', color);
            predefinedColors.forEach(sw => sw.classList.remove('active'));
            swatch.classList.add('active');
        });
    });

    // Kayıtlı vurgu rengini yükle
    const savedAccentColor = localStorage.getItem('chatlify-accent-color');
    if (savedAccentColor) {
        root.style.setProperty('--primary-color', savedAccentColor);
        root.style.setProperty('--primary-color-dark', chroma(savedAccentColor).darken(0.6).hex());
        accentColorPicker.value = savedAccentColor;
        document.querySelector(`.color-swatch[data-color='${savedAccentColor}']`)?.classList.add('active');
    }

    // Yazı Tipi Boyutu
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeValue = document.getElementById('font-size-value');
    if (fontSizeSlider && fontSizeValue) {
        fontSizeSlider.addEventListener('input', (e) => {
            const size = e.target.value;
            document.body.style.fontSize = `${size}%`; // Yüzde olarak ayarla
            fontSizeValue.textContent = `Boyut (${size}%)`;
            localStorage.setItem('chatlify-font-size', size);
        });
        const savedFontSize = localStorage.getItem('chatlify-font-size');
        if (savedFontSize) {
            fontSizeSlider.value = savedFontSize;
            document.body.style.fontSize = `${savedFontSize}%`;
            fontSizeValue.textContent = `Boyut (${savedFontSize}%)`;
        }
    }

    // Toggle Switch'ler için durum metni güncellemesi
    const toggleInputs = document.querySelectorAll('.toggle-input');
    toggleInputs.forEach(input => {
        const statusElement = input.closest('.toggle-switch').querySelector('.toggle-status');
        if (statusElement) {
            const updateStatusText = () => {
                statusElement.textContent = input.checked ? 'Açık' : 'Devre Dışı';
            };
            updateStatusText(); // Sayfa yüklendiğinde ilk durumu ayarla
            input.addEventListener('change', updateStatusText);
        }
    });

    // İki Faktörlü Doğrulama Butonu Etkinleştirme
    const twoFactorToggle = document.getElementById('two-factor-auth-toggle');
    const setup2faButton = document.getElementById('setup-2fa-button');
    if (twoFactorToggle && setup2faButton) {
        twoFactorToggle.addEventListener('change', () => {
            setup2faButton.disabled = !twoFactorToggle.checked;
        });
        setup2faButton.disabled = !twoFactorToggle.checked; // Sayfa yüklenirken de kontrol et
    }

    // Rahatsız Etmeyin Modu Zamanlama Göster/Gizle
    const dndToggle = document.getElementById('dnd-toggle');
    const dndSchedule = document.getElementById('dnd-schedule');
    if (dndToggle && dndSchedule) {
        dndToggle.addEventListener('change', () => {
            dndSchedule.style.display = dndToggle.checked ? 'flex' : 'none';
        });
        dndSchedule.style.display = dndToggle.checked ? 'flex' : 'none';
        // Stilde flex gap eklemek daha iyi olabilir.
        if (dndToggle.checked) {
            dndSchedule.style.gap = '10px';
            dndSchedule.style.alignItems = 'center';
        }
    }

    // Parola Değiştirme Modal
    const changePasswordModal = document.getElementById('change-password-modal');
    const changePasswordTrigger = document.getElementById('change-password-modal-trigger');
    const closeModalButton = document.querySelector('.close-modal-button');

    if (changePasswordTrigger && changePasswordModal && closeModalButton) {
        changePasswordTrigger.addEventListener('click', () => {
            changePasswordModal.style.display = 'block';
        });
        closeModalButton.addEventListener('click', () => {
            changePasswordModal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target === changePasswordModal) {
                changePasswordModal.style.display = 'none';
            }
        });
    }

    // Form gönderme işlemleri (Örnek)
    const saveProfileButton = document.querySelector('.save-profile-button');
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', () => {
            // Burada normalde API'ye veri gönderilir.
            alert('Profil bilgileri kaydedildi! (Simülasyon)');
        });
    }

    const changePasswordForm = document.getElementById('change-password-form');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Parola değiştirme mantığı
            alert('Parola değiştirme isteği gönderildi! (Simülasyon)');
            changePasswordModal.style.display = 'none';
        });
    }

    // Çıkış Yap Butonu
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
                // Gerçek çıkış işlemleri burada yapılır (localStorage temizleme, sunucuya istek vb.)
                alert('Çıkış yapıldı! (Simülasyon)');
                window.location.href = 'login.html'; // Giriş sayfasına yönlendir
            }
        });
    }

    // Chroma.js kütüphanesini yüklemek için basit bir kontrol
    // Gerçek bir uygulamada <script> etiketi ile HTML'e eklenmelidir.
    if (typeof chroma !== 'function') {
        console.warn('Chroma.js kütüphanesi yüklenemedi. Renk karartma işlevi çalışmayabilir.');
        // Basit bir fallback
        window.chroma = (color) => ({
            darken: () => color // Hiçbir şey yapma
        });
    }
}); 