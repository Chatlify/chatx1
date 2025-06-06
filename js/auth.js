import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', function () {
    // Form elementlerini seç
    const registerForm = document.getElementById('register-form');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('password-confirm');
    const errorMessageElement = document.getElementById('error-message');
    const registerButton = document.getElementById('register-button');

    // Profile photo elements
    const profilePhotoInput = document.getElementById('profile-photo');
    const profilePhotoPreview = document.getElementById('profile-photo-preview');
    const previewImage = document.getElementById('preview-image');
    const uploadIcon = document.querySelector('.upload-icon');
    const uploadText = document.querySelector('.upload-text');
    const resetPhotoBtn = document.getElementById('reset-photo');
    let profilePhotoFile = null;

    // Cloudinary configuration
    const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dxr8bxvbp/image/upload';
    const CLOUDINARY_UPLOAD_PRESET = 'chatlify_users';

    // Şifre gücü kontrolü için elementler
    const strengthMeter = document.querySelector('.strength-meter');
    const strengthValue = document.getElementById('strength-value');

    // Profile photo upload handling
    if (profilePhotoPreview && profilePhotoInput) {
        profilePhotoPreview.addEventListener('click', () => {
            profilePhotoInput.click();
        });

        profilePhotoInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                // File type and size validation
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
                if (!allowedTypes.includes(file.type)) {
                    showError('Please select a JPG, PNG, or GIF image.');
                    return;
                }

                const maxSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSize) {
                    showError('Image size must be less than 5MB.');
                    return;
                }

                // Save file for later upload
                profilePhotoFile = file;

                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImage.src = e.target.result;
                    previewImage.style.display = 'block';
                    uploadIcon.style.display = 'none';
                    uploadText.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });

        // Reset photo button
        if (resetPhotoBtn) {
            resetPhotoBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the preview click
                profilePhotoFile = null;
                profilePhotoInput.value = '';
                previewImage.style.display = 'none';
                uploadIcon.style.display = 'block';
                uploadText.style.display = 'block';
            });
        }
    }

    // Şifre gücünü kontrol et
    if (passwordInput) {
        passwordInput.addEventListener('input', function () {
            checkPasswordStrength(this.value);
        });
    }

    // Hata mesajlarını görüntüleme fonksiyonu
    function showError(message) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';

        // 3 saniye sonra hata mesajını otomatik olarak kaldır
        setTimeout(() => {
            errorMessageElement.style.display = 'none';
        }, 3000);
    }

    // Upload profile photo to Cloudinary
    async function uploadProfilePhoto(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            const response = await fetch(CLOUDINARY_URL, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok || !data.secure_url) {
                // Yükleme başarısız olduğunda veya URL gelmediğinde hata fırlat
                throw new Error(data.error?.message || 'Profil fotoğrafı yüklenemedi.');
            }

            return data.secure_url;
        } catch (error) {
            console.error('Profile photo upload error:', error);
            // Hatayı yeniden fırlatarak submit event listener'ın yakalamasını sağla
            throw error;
        }
    }

    // Form gönderildiğinde
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Buton yükleniyor durumuna getir
            registerButton.disabled = true;
            registerButton.innerHTML = '<div class="spinner"></div>';

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const passwordConfirm = passwordConfirmInput.value;

            // Form doğrulama
            if (!username || !email || !password || !passwordConfirm) {
                showError('Tüm alanları doldurun.');
                registerButton.disabled = false;
                registerButton.innerHTML = 'Hesap Oluştur';
                return;
            }

            if (password !== passwordConfirm) {
                showError('Şifreler eşleşmiyor.');
                registerButton.disabled = false;
                registerButton.innerHTML = 'Hesap Oluştur';
                return;
            }

            if (password.length < 6) {
                showError('Şifre en az 6 karakter olmalıdır.');
                registerButton.disabled = false;
                registerButton.innerHTML = 'Hesap Oluştur';
                return;
            }

            try {
                // Upload profile photo if selected
                let profilePhotoUrl = null;
                if (profilePhotoFile) {
                    profilePhotoUrl = await uploadProfilePhoto(profilePhotoFile);
                }

                // If no photo was selected, use a default avatar
                if (!profilePhotoUrl) {
                    const defaultAvatars = [
                        'images/chatlifyprofile1.png',
                        'images/chatlifyprofile2.png',
                        'images/chatlifyprofile3.png',
                        'images/chatlifyprofile4.png'
                    ];
                    const randomIndex = Math.floor(Math.random() * defaultAvatars.length);
                    // Tam URL oluştur
                    profilePhotoUrl = new URL(defaultAvatars[randomIndex], window.location.origin).href;
                }

                // Supabase ile kayıt ol
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            username: username,
                            avatar: profilePhotoUrl
                        }
                    }
                });

                if (error) {
                    throw error;
                }

                // Kayıt başarılı - Doğrulama e-postası gönderildi
                alert('Kayıt başarılı! Lütfen e-posta adresinizi kontrol edin ve hesabınızı doğrulayın.');
                window.location.href = 'login.html';

            } catch (error) {
                console.error('Kayıt hatası:', error);

                // Kullanıcı dostu hata mesajları
                if (error.message.includes('already registered')) {
                    showError('Bu e-posta adresi zaten kayıtlı.');
                } else if (error.message.includes('Profil fotoğrafı yüklenemedi')) {
                    showError(error.message); // Cloudinary'den gelen hatayı doğrudan göster
                } else {
                    showError('Kayıt olurken bir hata oluştu. Lütfen tekrar deneyin.');
                }

                // Buton normal duruma getir
                registerButton.disabled = false;
                registerButton.innerHTML = 'Hesap Oluştur';
            }
        });
    }

    // Şifre göster/gizle butonları
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const type = targetInput.getAttribute('type') === 'password' ? 'text' : 'password';
            targetInput.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    });

    // Şifre gücünü ölç
    function checkPasswordStrength(password) {
        if (!strengthMeter || !strengthValue) return;

        let strength = 0;

        // Şifre boş ise
        if (password.length === 0) {
            updateStrengthMeter(0);
            return;
        }

        // Şifre uzunluğu kontrolü
        if (password.length >= 8) strength++;

        // Karakter çeşitliliği kontrolü
        if (/[A-Z]/.test(password)) strength++; // Büyük harf
        if (/[0-9]/.test(password)) strength++; // Rakam
        if (/[^A-Za-z0-9]/.test(password)) strength++; // Özel karakter

        updateStrengthMeter(strength);
    }

    // Şifre gücü göstergesini güncelle
    function updateStrengthMeter(strength) {
        // Şifre gücü metni
        let text = '';
        switch (strength) {
            case 0:
                text = 'Zayıf';
                break;
            case 1:
                text = 'Zayıf';
                break;
            case 2:
                text = 'Orta';
                break;
            case 3:
                text = 'İyi';
                break;
            case 4:
                text = 'Mükemmel';
                break;
        }
        strengthValue.textContent = text;

        // Şifre gücü sınıfını ayarla
        strengthMeter.className = 'strength-meter strength-' + strength;

        // Her segment için doldurma durumunu ayarla
        const segments = strengthMeter.querySelectorAll('.strength-segment');
        segments.forEach((segment, index) => {
            if (index < strength) {
                segment.classList.add('filled');
            } else {
                segment.classList.remove('filled');
            }
        });
    }

    // DOM yüklendiğinde, form elemanlarının yerini değiştir
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('register-form');
        if (form) {
            const usernameGroup = form.querySelector('.form-group:has(#username)');
            const profilePhotoGroup = form.querySelector('.form-group:has(#profile-photo)');

            if (usernameGroup && profilePhotoGroup) {
                // Profil fotoğrafı grubunu, kullanıcı adı grubunun önüne taşı
                form.insertBefore(profilePhotoGroup, usernameGroup);
            }
        }
    });
});
