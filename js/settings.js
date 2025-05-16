document.addEventListener('DOMContentLoaded', () => {
    // Tema ayarlarını yükle
    loadThemePreferences();

    // Menü geçişlerini ayarla 
    setupSettingsNavigation();

    // Form işleyicilerini ayarla
    setupFormHandlers();

    // Modal işleyicilerini ayarla
    setupModalHandlers();

    // Toggle ve diğer UI öğelerini ayarla
    setupUIElements();

    // Kullanıcı profil bilgilerini yükle (demosu)
    loadUserDemo();
});

// Kullanıcı profil bilgilerini yükle (demo için)
function loadUserDemo() {
    // Demo profil verileri
    const userProfile = {
        username: 'AhmetYılmaz',
        tag: '#2345',
        email: 'ahmet.yilmaz@example.com',
        avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        bio: 'Yazılım geliştiricisi ve teknoloji meraklısı. Oyun oynamayı ve yeni şeyler öğrenmeyi seviyorum!',
        status: 'online',
        socialLinks: {
            twitter: 'ahmetyilmaz',
            instagram: 'ahmet.tech',
            github: 'ahmet-dev'
        }
    };

    // Profil resmi
    const profileImage = document.getElementById('profile-image');
    if (profileImage) {
        profileImage.src = userProfile.avatar;
    }

    // Profil adı
    const profileName = document.getElementById('profile-name');
    if (profileName) {
        profileName.textContent = userProfile.username;
    }

    // Form alanlarını doldur
    const displayNameInput = document.getElementById('display-name');
    if (displayNameInput) {
        displayNameInput.value = userProfile.username;
    }

    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.value = userProfile.email;
    }

    // Bio
    const bioInput = document.getElementById('bio');
    if (bioInput) {
        bioInput.value = userProfile.bio;
    }

    // Sosyal bağlantılar
    if (userProfile.socialLinks) {
        const socialInputs = document.querySelectorAll('.social-link-item input');
        if (socialInputs.length > 0) {
            socialInputs[0].value = userProfile.socialLinks.twitter || '';
            if (socialInputs.length > 1) {
                socialInputs[1].value = userProfile.socialLinks.instagram || '';
            }
            if (socialInputs.length > 2) {
                socialInputs[2].value = userProfile.socialLinks.github || '';
            }
        }
    }
}

// Ayarlar menüsü navigasyonu
function setupSettingsNavigation() {
    const menuItems = document.querySelectorAll('.settings-menu-item');
    const sections = document.querySelectorAll('.settings-section');

    // Menü öğelerine tıklama işleyicisi ekle
    menuItems.forEach(item => {
        if (item.id === 'logout-button') {
            item.addEventListener('click', handleLogout);
            return;
        }

        item.addEventListener('click', () => {
            const sectionId = item.getAttribute('data-section');

            // Aktif menü öğesini güncelle
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');

            // Aktif bölümü güncelle
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Arama işlevselliği
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();

            // Menü öğelerinde ara
            menuItems.forEach(item => {
                if (item.id === 'logout-button') return;

                const itemText = item.querySelector('span').textContent.toLowerCase();
                if (searchTerm === '' || itemText.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}

// Form işleyicileri kurulumu
function setupFormHandlers() {
    // Hesap formu
    const accountForm = document.getElementById('account-form');
    if (accountForm) {
        accountForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Form verilerini topla
            const formData = new FormData(accountForm);
            const displayName = formData.get('display-name');
            const email = formData.get('email');
            const phone = formData.get('phone');

            // Normal durumda burada bir API çağrısı yapılırdı
            console.log('Hesap bilgileri güncelleniyor:', { displayName, email, phone });

            // Başarılı bildirim göster
            showToast('Hesap bilgileriniz başarıyla güncellendi', 'success');

            // Profile name güncelle (demo)
            const profileName = document.getElementById('profile-name');
            if (profileName) {
                profileName.textContent = displayName;
            }
        });
    }

    // Profil formu
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Form verilerini topla
            const formData = new FormData(profileForm);
            const bio = formData.get('bio');
            const twitter = formData.get('twitter');
            const instagram = formData.get('instagram');
            const github = formData.get('github');

            // Normal durumda burada bir API çağrısı yapılırdı
            console.log('Profil bilgileri güncelleniyor:', { bio, twitter, instagram, github });

            // Başarılı bildirim göster
            showToast('Profil bilgileriniz başarıyla güncellendi', 'success');
        });
    }

    // Şifre değiştirme formu
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Form verilerini topla
            const formData = new FormData(passwordForm);
            const currentPassword = formData.get('current-password');
            const newPassword = formData.get('new-password');
            const confirmPassword = formData.get('confirm-password');

            // Basit doğrulama
            if (newPassword !== confirmPassword) {
                showToast('Yeni şifreler eşleşmiyor', 'error');
                return;
            }

            if (newPassword.length < 8) {
                showToast('Şifre en az 8 karakter olmalıdır', 'error');
                return;
            }

            // Normal durumda burada bir API çağrısı yapılırdı
            console.log('Şifre değiştiriliyor');

            // Modalı kapat
            closeModal('password-modal');

            // Başarılı bildirim göster
            showToast('Şifreniz başarıyla değiştirildi', 'success');

            // Formu sıfırla
            passwordForm.reset();
        });
    }

    // Hesap silme formu
    const deleteAccountForm = document.getElementById('delete-account-form');
    if (deleteAccountForm) {
        const deleteConfirmationInput = document.getElementById('delete-confirmation');
        const deleteButton = deleteAccountForm.querySelector('button[type="submit"]');

        // Onay giriş alanını dinle
        if (deleteConfirmationInput && deleteButton) {
            deleteConfirmationInput.addEventListener('input', () => {
                if (deleteConfirmationInput.value === 'HESABIMI SİL') {
                    deleteButton.removeAttribute('disabled');
                } else {
                    deleteButton.setAttribute('disabled', 'disabled');
                }
            });
        }

        deleteAccountForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Form verilerini topla
            const formData = new FormData(deleteAccountForm);
            const confirmation = formData.get('delete-confirmation');
            const password = formData.get('delete-password');

            // Doğrulama
            if (confirmation !== 'HESABIMI SİL') {
                showToast('Lütfen onay metnini doğru girin', 'error');
                return;
            }

            if (!password) {
                showToast('Lütfen şifrenizi girin', 'error');
                return;
            }

            // Normal durumda burada bir API çağrısı yapılırdı
            console.log('Hesap siliniyor');

            // Modalı kapat
            closeModal('delete-account-modal');

            // Bildirim göster
            showToast('Hesabınız silindi', 'info');

            // Demo için logout işlemini taklit et
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        });
    }
}

// Modal işleyicileri
function setupModalHandlers() {
    // Şifre değiştirme modalı
    const changePasswordButton = document.getElementById('change-password-button');
    const passwordModal = document.getElementById('password-modal');

    if (changePasswordButton && passwordModal) {
        changePasswordButton.addEventListener('click', () => {
            openModal('password-modal');
        });
    }

    // Hesap silme modalı
    const deleteAccountButton = document.getElementById('delete-account-button');
    const deleteAccountModal = document.getElementById('delete-account-modal');

    if (deleteAccountButton && deleteAccountModal) {
        deleteAccountButton.addEventListener('click', () => {
            openModal('delete-account-modal');
        });
    }

    // Tüm modal kapatma düğmelerini ayarla
    document.querySelectorAll('.modal-close, .cancel-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const modalId = e.target.closest('.modal').id;
            closeModal(modalId);
        });
    });

    // Şifre görünürlük toggleları
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const passwordInput = e.target.closest('.input-group').querySelector('input');
            const icon = e.target.tagName === 'I' ? e.target : e.target.querySelector('i');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });

    // Modal dışına tıklama
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

// UI öğelerinin kurulumu
function setupUIElements() {
    // Tema seçicileri
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length) {
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Aktif sınıfını değiştir
                themeOptions.forEach(o => o.classList.remove('active'));
                option.classList.add('active');

                // Temayı uygula
                const theme = option.getAttribute('data-theme');
                document.documentElement.setAttribute('data-theme', theme);
                localStorage.setItem('theme', theme);

                showToast('Tema değiştirildi', 'success');
            });
        });
    }

    // Profil resmi düzenleme
    const profileImageEdit = document.querySelector('.profile-image-edit');
    if (profileImageEdit) {
        profileImageEdit.addEventListener('click', () => {
            // Gerçek uygulamada burada bir dosya seçici açılırdı
            showToast('Profil resmi değiştirme özelliği çok yakında!', 'info');
        });
    }

    // Banner düzenleme
    const bannerEditButton = document.querySelector('.banner-edit-button');
    if (bannerEditButton) {
        bannerEditButton.addEventListener('click', () => {
            // Gerçek uygulamada burada bir dosya seçici açılırdı
            showToast('Banner değiştirme özelliği çok yakında!', 'info');
        });
    }

    // Sosyal medya bağlantısı ekleme
    const addSocialButton = document.querySelector('.add-social-button');
    if (addSocialButton) {
        addSocialButton.addEventListener('click', () => {
            // Örnek olarak yeni bir bağlantı öğesi ekle
            const socialLinks = document.querySelector('.social-links');
            const newLink = document.createElement('div');
            newLink.className = 'social-link-item';
            newLink.innerHTML = `
                <i class="fab fa-discord social-icon"></i>
                <input type="text" placeholder="Discord Kullanıcı Adı" name="discord">
                <button type="button" class="remove-social-button">
                    <i class="fas fa-times"></i>
                </button>
            `;

            // Yeni bağlantıyı ekle
            socialLinks.insertBefore(newLink, addSocialButton);

            // Silme düğmesine olay dinleyicisi ekle
            const removeButton = newLink.querySelector('.remove-social-button');
            removeButton.addEventListener('click', () => {
                newLink.remove();
            });
        });
    }

    // Toggle switchler ve diğer ayarlar
    document.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const settingName = checkbox.id;
            const isEnabled = checkbox.checked;

            console.log(`Ayar değiştirildi: ${settingName} = ${isEnabled}`);

            // Özel durumlar
            if (settingName === 'all-messages' && isEnabled) {
                // Diğer mesaj seçeneklerini kapat
                document.getElementById('mentions-only').checked = false;
                document.getElementById('no-messages').checked = false;
            } else if (settingName === 'mentions-only' && isEnabled) {
                document.getElementById('all-messages').checked = false;
                document.getElementById('no-messages').checked = false;
            } else if (settingName === 'no-messages' && isEnabled) {
                document.getElementById('all-messages').checked = false;
                document.getElementById('mentions-only').checked = false;
            }
        });
    });

    // Yazı boyutu slider'ı
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', () => {
            const fontSize = fontSizeSlider.value;
            document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
        });
    }
}

// Tema tercihlerini yükle
function loadThemePreferences() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Tema seçeneklerindeki aktif olan butonu ayarla
    const themeOptions = document.querySelectorAll('.theme-option');
    if (themeOptions.length) {
        themeOptions.forEach(option => {
            if (option.getAttribute('data-theme') === savedTheme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
}

// Modal açma fonksiyonu
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.classList.add('active');
        }, 10);
    }
}

// Modal kapatma fonksiyonu
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// Toast bildirim gösterme
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}"></i>
        </div>
        <div class="toast-content">${message}</div>
        <button class="toast-close">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Kapat düğmesine tıklama
    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });

    // Toast'u ekle
    toastContainer.appendChild(toast);

    // Animasyon için küçük gecikme
    setTimeout(() => {
        toast.classList.add('toast-showing');
    }, 10);

    // Otomatik olarak kaldır
    setTimeout(() => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 5000);
}

// Çıkış yapma fonksiyonu
function handleLogout() {
    if (confirm('Çıkış yapmak istediğinize emin misiniz?')) {
        // Çıkış işlemleri burada yapılır
        showToast('Çıkış yapılıyor...', 'info');

        // Çıkış sayfasına yönlendir
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }
}
