import { supabase } from './auth_config.js';

// *** Cloudinary Ayarları ***
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/chatlify/image/upload' || null;
const CLOUDINARY_UPLOAD_PRESET = 'chatlify_users' || null;

// API anahtarlarının kontrolü
if (!CLOUDINARY_URL || !CLOUDINARY_UPLOAD_PRESET) {
    console.error('Cloudinary ayarları bulunamadı!');
}

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const submitButton = document.getElementById('submitBtn'); // ID ile seç
    const buttonText = submitButton.querySelector('.btn-text');
    const loadingSpinner = submitButton.querySelector('.loading-spinner');
    const termsCheckbox = document.getElementById('terms');

    // *** Input Alanlarını Burada Tanımla ***
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password'); // Şifre gücü için de kullanılacak
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // Avatar Elements
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarPreviewImg = avatarPreview.querySelector('.avatar-preview-img');
    const avatarPreviewText = avatarPreview.querySelector('.avatar-preview-text');
    const avatarUploadIcon = avatarPreview.querySelector('.avatar-upload-icon');
    let avatarFile = null; // Seçilen dosyayı tutmak için

    // Şifre gücü elementleri
    const strengthValueSpan = document.getElementById('strengthValue');
    const strengthMeter = document.querySelector('.strength-meter'); // Meter container

    // Hata ve başarı mesajları için elementler
    const formMessage = document.createElement('div');
    formMessage.className = 'form-message';
    registerForm.prepend(formMessage);

    // Varsayılan avatar dosya isimleri (images/ altında olmalı)
    const defaultAvatarFiles = [
        'images/chatlifyprofile1.png',
        'images/chatlifyprofile2.png',
        'images/chatlifyprofile3.png',
        'images/chatlifyprofile4.png'
    ];

    // --- Avatar Yükleme ve Önizleme İşlevi ---
    avatarPreview.addEventListener('click', () => {
        avatarInput.click(); // Gizli inputu tetikle
    });

    avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Dosya tipi ve boyut kontrolü (isteğe bağlı)
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                displayAvatarError('Geçersiz dosya türü. Lütfen PNG, JPG veya GIF seçin.');
                avatarFile = null;
                // Önizlemeyi sıfırla
                avatarPreviewImg.style.display = 'none';
                avatarPreviewText.style.display = 'block';
                avatarUploadIcon.style.display = 'block';
                return;
            }
            const maxSize = 5 * 1024 * 1024; // 5MB limit
            if (file.size > maxSize) {
                displayAvatarError('Dosya boyutu 5MB sınırını aşıyor.');
                avatarFile = null;
                // Önizlemeyi sıfırla
                avatarPreviewImg.style.display = 'none';
                avatarPreviewText.style.display = 'block';
                avatarUploadIcon.style.display = 'block';
                return;
            }

            avatarFile = file; // Seçilen dosyayı sakla
            const reader = new FileReader();
            reader.onload = function (e) {
                avatarPreviewImg.src = e.target.result;
                avatarPreviewImg.style.display = 'block';
                avatarPreviewText.style.display = 'none';
                avatarUploadIcon.style.display = 'none';
                clearAvatarError();
            }
            reader.readAsDataURL(file);
        } else {
            // Dosya seçilmedi veya iptal edildi
            avatarFile = null;
            avatarPreviewImg.style.display = 'none';
            avatarPreviewText.style.display = 'block';
            avatarUploadIcon.style.display = 'block';
            clearAvatarError();
        }
    });

    function displayAvatarError(message) {
        const avatarError = document.getElementById('avatarError');
        if (avatarError) avatarError.textContent = message;
    }
    function clearAvatarError() {
        displayAvatarError('');
    }
    // --- End Avatar ---    

    // --- Şifre Gücü Kontrolü ---
    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength += 1; // Uzunluk
        if (password.match(/[a-z]/)) strength += 1; // Küçük harf
        if (password.match(/[A-Z]/)) strength += 1; // Büyük harf
        if (password.match(/[0-9]/)) strength += 1; // Rakam
        if (password.match(/[^a-zA-Z0-9]/)) strength += 1; // Özel karakter

        let strengthText = 'Very Weak';
        let strengthLevel = 0; // 0-4 arası seviye

        if (strength < 2) {
            strengthText = 'Weak';
            strengthLevel = 1;
        } else if (strength === 2) {
            strengthText = 'Medium';
            strengthLevel = 2;
        } else if (strength === 3 || strength === 4) {
            strengthText = 'Strong';
            strengthLevel = 3;
        } else if (strength >= 5) {
            strengthText = 'Very Strong';
            strengthLevel = 4;
        }

        if (password.length === 0) {
            strengthText = 'Weak'; // Boşsa default
            strengthLevel = 0;
        }

        // Update text
        if (strengthValueSpan) {
            strengthValueSpan.textContent = strengthText;
            // Optionally update class for color coding text
            strengthValueSpan.className = `strength-${strengthText.toLowerCase().replace(' ', '-')}`;
        }

        // Update meter segments
        if (strengthMeter) {
            const segments = strengthMeter.querySelectorAll('.strength-segment');
            segments.forEach((segment, index) => {
                if (index < strengthLevel) {
                    segment.classList.add('filled', `level-${strengthLevel}`);
                    segment.classList.remove('level-1', 'level-2', 'level-3'); // Remove other levels if changing
                    if (strengthLevel === 1) segment.classList.remove('level-2', 'level-3', 'level-4');
                    if (strengthLevel === 2) segment.classList.remove('level-1', 'level-3', 'level-4');
                    if (strengthLevel === 3) segment.classList.remove('level-1', 'level-2', 'level-4');
                    if (strengthLevel === 4) segment.classList.remove('level-1', 'level-2', 'level-3');
                    segment.classList.add(`level-${strengthLevel}`);

                } else {
                    segment.classList.remove('filled', 'level-1', 'level-2', 'level-3', 'level-4');
                }
            });
            // Add overall class to meter for potential styling
            strengthMeter.className = `strength-meter strength-${strengthLevel}`;
        }

    }

    if (passwordInput) { // passwordInput'ı kullan
        passwordInput.addEventListener('input', (event) => {
            checkPasswordStrength(event.target.value);
        });
        checkPasswordStrength(passwordInput.value);
    }
    // --- End Şifre Gücü ---

    // --- Terms Checkbox Kontrolü ---
    termsCheckbox.addEventListener('change', () => {
        submitButton.disabled = !termsCheckbox.checked;
    });
    // --- End Terms ---    

    // --- Form Gönderme İşlevi ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors(); // Önceki hataları temizle

        // Alanlardan değerleri al ve doğrula
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        let isValid = true;
        if (!validateUsername(username)) isValid = false;
        if (!validateEmail(email)) isValid = false;
        if (!validatePassword(password)) isValid = false;
        if (!validateConfirmPassword(password, confirmPassword)) isValid = false;

        if (!termsCheckbox.checked) { // Terms kontrolü
            displayError(registerForm.querySelector('.form-error'), 'Kullanım koşullarını kabul etmelisiniz.');
            isValid = false;
        }

        if (!isValid) return;

        // Butonu yükleniyor durumuna getir
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Kayıt Olunuyor...';

        let finalAvatarUrl = null;

        // 1. Adım: Avatar yüklemesi (eğer bir dosya seçildiyse)
        if (avatarFile) {
            console.log('Özel avatar yükleniyor...');
            formMessage.textContent = 'Profil fotoğrafı yükleniyor...';
            const formData = new FormData();
            formData.append('file', avatarFile);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

            try {
                const response = await fetch(CLOUDINARY_URL, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await response.json();
                if (response.ok && uploadData.secure_url) {
                    finalAvatarUrl = uploadData.secure_url;
                    console.log('Avatar başarıyla yüklendi:', finalAvatarUrl);
                } else {
                    // Yükleme başarısız olursa, bir hata fırlat ve işlemi durdur
                    throw new Error(uploadData.error?.message || 'Cloudinary yüklemesi başarısız oldu');
                }
            } catch (uploadError) {
                console.error('Avatar Yükleme Hatası:', uploadError);
                formMessage.textContent = `Profil fotoğrafı yüklenemedi. Lütfen farklı bir resim deneyin veya daha sonra tekrar deneyin.`;
                formMessage.className = 'form-message error'; // Hata stili ekle

                // Butonu sıfırla ve fonksiyonun çalışmasını tamamen durdur
                submitButton.disabled = false;
                submitButton.innerHTML = 'Kayıt Ol';
                return; // Kayıt işlemine devam etme
            }
        }

        // 2. Adım: Supabase'e kayıt ol
        try {
            // Eğer hala bir avatar URL'si yoksa (kullanıcı seçmediyse), varsayılanı ata
            if (!finalAvatarUrl) {
                const randomIndex = Math.floor(Math.random() * defaultAvatarFiles.length);
                const randomAvatarName = defaultAvatarFiles[randomIndex];
                finalAvatarUrl = new URL(randomAvatarName, window.location.origin).href;
                console.log('Varsayılan avatar atandı:', finalAvatarUrl);
            }

            formMessage.textContent = 'Hesap oluşturuluyor...';
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username,
                        avatar: finalAvatarUrl
                    }
                }
            });

            if (error) {
                // Supabase'den gelen hatayı yakala ve fırlat
                throw error;
            }

            // Başarılı kayıt
            alert('Kayıt başarılı! Hesabınızı doğrulamak için e-postanızı kontrol edin ve ardından giriş yapın.');
            window.location.href = 'login.html';

        } catch (err) {
            console.error('Genel Kayıt Hatası:', err);
            // Hata mesajını kullanıcıya göster
            if (err.message.includes('already registered')) {
                displayError(document.getElementById('emailError'), 'Bu e-posta adresi zaten kayıtlı.');
            } else if (err.message.includes('Password should be at least')) {
                displayError(document.getElementById('passwordError'), 'Şifre en az 6 karakter olmalıdır.');
            } else {
                formMessage.textContent = `Kayıt sırasında bir hata oluştu: ${err.message}`;
                formMessage.className = 'form-message error';
            }

            // Butonu tekrar eski haline getir
            submitButton.disabled = false;
            submitButton.innerHTML = 'Kayıt Ol';
        }
    });
    // --- End Form Submit ---    

    // --- Yardımcı Fonksiyonlar (Hata Gösterme vb.) ---
    function clearErrors() {
        console.log('🧹 Hatalar temizleniyor...');
        const errorElements = registerForm.querySelectorAll('.error-message, .form-error');
        errorElements.forEach(el => el.textContent = '');
        // Input kenarlıklarını da sıfırla (varsa)
        const invalidInputs = registerForm.querySelectorAll('.invalid');
        invalidInputs.forEach(el => el.classList.remove('invalid'));
        // Genel form mesajını temizle
        if (formMessage) {
            formMessage.textContent = '';
            formMessage.className = 'form-message'; // Sınıfı da sıfırla
        }
    }

    function displayError(element, message) {
        if (element) {
            element.textContent = message;
            // İlgili input alanını bulup stil ekleyebiliriz
            const input = element.previousElementSibling; // Genellikle input elementin hemen önündedir
            if (input && (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA')) {
                input.classList.add('invalid');
            }
        } else {
            console.warn('Hata gösterilecek element bulunamadı:', message);
        }
    }

    function validateUsername(username) {
        const usernameError = document.getElementById('usernameError');
        if (!username) {
            displayError(usernameError, 'Kullanıcı adı gerekli.');
            return false;
        }
        if (username.length < 3) {
            displayError(usernameError, 'Kullanıcı adı en az 3 karakter olmalı.');
            return false;
        }
        // Başka username kuralları eklenebilir
        return true;
    }

    function validateEmail(email) {
        const emailError = document.getElementById('emailError');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            displayError(emailError, 'E-posta gerekli.');
            return false;
        }
        if (!emailRegex.test(email)) {
            displayError(emailError, 'Geçersiz e-posta formatı.');
            return false;
        }
        return true;
    }

    function validatePassword(password) {
        const passwordError = document.getElementById('passwordError');
        if (!password) {
            displayError(passwordError, 'Şifre gerekli.');
            return false;
        }
        if (password.length < 6) { // Supabase varsayılanı 6
            displayError(passwordError, 'Şifre en az 6 karakter olmalı.');
            return false;
        }
        // Şifre gücü kontrolü (isteğe bağlı)
        checkPasswordStrength(password);
        return true;
    }

    function validateConfirmPassword(password, confirmPassword) {
        const confirmPasswordError = document.getElementById('confirmPasswordError');
        if (!confirmPassword) {
            displayError(confirmPasswordError, 'Şifre tekrarı gerekli.');
            return false;
        }
        if (password !== confirmPassword) {
            displayError(confirmPasswordError, 'Şifreler eşleşmiyor.');
            return false;
        }
        return true;
    }

}); 