document.addEventListener('DOMContentLoaded', () => {
    // Tema ayarlarını yükle
    loadThemePreferences();

    // Tüm modalları gizle - EKLENEN KOD 
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
        modal.classList.remove('active', 'show');
    });

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
    // Kategori öğelerine tıklama işleyicisi ekle
    const categoryItems = document.querySelectorAll('.category-item');
    const sections = document.querySelectorAll('.settings-section');
    const headerTitle = document.querySelector('.header-title span');
    const headerIcon = document.querySelector('.header-title i');

    console.log('Kategori öğeleri:', categoryItems.length);
    console.log('İçerik bölümleri:', sections.length);

    // Her kategori öğesinin data-category özelliğini kontrol et
    categoryItems.forEach(item => {
        const categoryName = item.getAttribute('data-category');
        console.log('Kategori:', categoryName);
    });

    // Her bölümün ID'sini kontrol et
    sections.forEach(section => {
        console.log('Bölüm ID:', section.id);
    });

    // İlk kategoriyi varsayılan olarak aktif et (sayfa yüklendiğinde)
    if (categoryItems.length > 0) {
        const firstItem = categoryItems[0];
        const firstCategory = firstItem.getAttribute('data-category');

        console.log('İlk kategori seçiliyor:', firstCategory);

        // İlk kategoriyi aktif yap
        firstItem.classList.add('active');

        // İlk bölümü görünür yap
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === firstCategory + '-settings') {
                section.classList.add('active');
                console.log('İlk bölüm aktif edildi:', section.id);
            }
        });

        // Başlığı güncelle
        if (headerTitle) {
            const categoryLabel = firstItem.querySelector('.category-label').textContent;
            headerTitle.textContent = categoryLabel + ' Ayarları';
        }

        // Başlık ikonunu güncelle
        if (headerIcon) {
            const categoryIcon = firstItem.querySelector('.category-icon i').className;
            headerIcon.className = categoryIcon;
        }
    }

    // Kategori öğelerine tıklama işleyicisi ekle
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            // Kategori adını al
            const categoryName = item.getAttribute('data-category');
            const categoryLabel = item.querySelector('.category-label').textContent;
            const categoryIcon = item.querySelector('.category-icon i').className;

            console.log('Kategori tıklandı:', categoryName);

            // Aktif kategoriyi güncelle
            categoryItems.forEach(ci => ci.classList.remove('active'));
            item.classList.add('active');

            // Başlığı güncelle
            if (headerTitle) {
                headerTitle.textContent = categoryLabel + ' Ayarları';
            }

            // Başlık ikonunu güncelle
            if (headerIcon) {
                headerIcon.className = categoryIcon;
            }

            // İlgili içerik bölümünü göster
            let foundSection = false;
            const targetSectionId = categoryName + '-settings';

            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetSectionId) {
                    section.classList.add('active');
                    foundSection = true;
                    console.log('Bölüm aktif edildi:', section.id);
                }
            });

            if (!foundSection) {
                console.error('İlgili bölüm bulunamadı:', targetSectionId);
                console.log('Mevcut bölümler:', Array.from(sections).map(s => s.id).join(', '));
            }
        });
    });

    // Arama işlevselliği
    const searchInput = document.getElementById('settings-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();

            // Kategori öğelerinde ara
            categoryItems.forEach(item => {
                const itemText = item.querySelector('.category-label').textContent.toLowerCase();
                if (searchTerm === '' || itemText.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }

    // Çıkış butonuna tıklama işleyicisi ekle
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
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
    const changePasswordBtn = document.querySelector('.change-password-btn');
    const passwordModal = document.getElementById('password-modal');

    if (changePasswordBtn && passwordModal) {
        changePasswordBtn.addEventListener('click', () => {
            openModal('password-modal');
        });
    }

    // Hesap silme modalı
    const deleteAccountBtn = document.querySelector('.delete-account-btn');
    const deleteAccountModal = document.getElementById('delete-account-modal');

    if (deleteAccountBtn && deleteAccountModal) {
        deleteAccountBtn.addEventListener('click', () => {
            openModal('delete-account-modal');
        });
    }

    // Tüm modal kapatma düğmelerini ayarla
    document.querySelectorAll('.modal-close-btn, #cancel-password-change, #cancel-account-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Şifre değiştirme onay butonu
    const confirmPasswordChange = document.getElementById('confirm-password-change');
    if (confirmPasswordChange) {
        confirmPasswordChange.addEventListener('click', () => {
            // Gerçek uygulamada burada şifre değiştirme API çağrısı yapılırdı
            closeModal('password-modal');
            showToast('Şifreniz başarıyla değiştirildi', 'success');
        });
    }

    // Hesap silme onay butonu
    const confirmAccountDelete = document.getElementById('confirm-account-delete');
    const deleteConfirmation = document.getElementById('delete-confirmation');

    if (deleteConfirmation && confirmAccountDelete) {
        deleteConfirmation.addEventListener('input', () => {
            if (deleteConfirmation.value.toLowerCase() === 'hesabımı sil') {
                confirmAccountDelete.removeAttribute('disabled');
            } else {
                confirmAccountDelete.setAttribute('disabled', 'disabled');
            }
        });

        confirmAccountDelete.addEventListener('click', () => {
            // Gerçek uygulamada burada hesap silme API çağrısı yapılırdı
            closeModal('delete-account-modal');
            showToast('Hesabınız başarıyla silindi', 'success');

            // Demo için ana sayfaya yönlendirme
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        });
    }

    // Modal dışına tıklama
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Parola gereksinimleri kontrolü
    const newPassword = document.getElementById('new-password');
    if (newPassword) {
        newPassword.addEventListener('input', validatePassword);
    }
}

// Parola gereksinimleri kontrolü
function validatePassword() {
    const password = document.getElementById('new-password').value;

    // Gereksinimleri kontrol et
    const lengthRequirement = document.getElementById('length-requirement');
    const uppercaseRequirement = document.getElementById('uppercase-requirement');
    const numberRequirement = document.getElementById('number-requirement');
    const specialRequirement = document.getElementById('special-requirement');

    // Uzunluk kontrolü
    if (password.length >= 8) {
        lengthRequirement.classList.add('valid');
    } else {
        lengthRequirement.classList.remove('valid');
    }

    // Büyük harf kontrolü
    if (/[A-Z]/.test(password)) {
        uppercaseRequirement.classList.add('valid');
    } else {
        uppercaseRequirement.classList.remove('valid');
    }

    // Rakam kontrolü
    if (/[0-9]/.test(password)) {
        numberRequirement.classList.add('valid');
    } else {
        numberRequirement.classList.remove('valid');
    }

    // Özel karakter kontrolü
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        specialRequirement.classList.add('valid');
    } else {
        specialRequirement.classList.remove('valid');
    }
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
            modal.classList.add('show');
        }, 10);
    }
}

// Modal kapatma fonksiyonu
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
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
