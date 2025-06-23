import { supabase } from './auth_config.js';

// Cloudinary Ayarları
// Bu değerleri kendi Cloudinary hesabınızdan almanız gerekiyor:
// 1. https://cloudinary.com adresine gidin ve ücretsiz hesap oluşturun
// 2. Dashboard'a girin ve Cloud name değerini alın (örn: "your_cloud_name")
// 3. Settings > Upload > Upload presets bölümüne gidin ve "unsigned" bir preset oluşturun
// 4. Oluşturduğunuz preset'in adını aşağıya yazın (örn: "your_upload_preset")
const CLOUDINARY_CLOUD_NAME = 'dxr8bxvbp'; // Cloudinary dashboard'dan alınan cloud name
const CLOUDINARY_UPLOAD_PRESET = 'chatlify_users'; // Unsigned upload preset adı
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const formErrors = document.querySelectorAll('.form-error');

    // Avatar elementleri
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreviewImg = document.querySelector('.avatar-preview-img');
    const avatarPreviewText = document.querySelector('.avatar-preview-text');
    let avatarFile = null;

    // Varsayılan avatar dosya isimleri
    const defaultAvatarFiles = [
        'images/chatlifyprofile1.png',
        'images/chatlifyprofile2.png',
        'images/chatlifyprofile3.png',
        'images/chatlifyprofile4.png'
    ];

    const fields = {
        username: { input: document.getElementById('username'), error: document.querySelector('[data-for="username"]'), validation: (value) => value.length >= 3 },
        email: { input: document.getElementById('email'), error: document.querySelector('[data-for="email"]'), validation: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
        password: { input: document.getElementById('password'), error: document.querySelector('[data-for="password"]'), validation: (value) => value.length >= 8 },
        confirmPassword: { input: document.getElementById('confirmPassword'), error: document.querySelector('[data-for="confirmPassword"]'), validation: (value) => value === fields.password.input.value && value.length > 0 },
        terms: { input: document.getElementById('terms'), error: null, validation: (value) => value.checked }
    };

    // Avatar yükleme işlevselliği
    avatarPreview.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // Dosya tipi ve boyut kontrolü
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                showError('avatar', 'Geçersiz dosya türü. Lütfen PNG, JPG veya GIF seçin.');
                avatarFile = null;
                resetAvatarPreview();
                return;
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                showError('avatar', 'Dosya boyutu 5MB sınırını aşıyor.');
                avatarFile = null;
                resetAvatarPreview();
                return;
            }

            // Dosyayı sakla ve önizleme göster
            avatarFile = file;
            const reader = new FileReader();
            reader.onload = function (e) {
                avatarPreviewImg.src = e.target.result;
                avatarPreviewImg.style.display = 'block';
                avatarPreviewText.style.display = 'none';
                clearError('avatar');
            };
            reader.readAsDataURL(file);
        } else {
            avatarFile = null;
            resetAvatarPreview();
        }
    });

    function resetAvatarPreview() {
        avatarPreviewImg.style.display = 'none';
        avatarPreviewText.style.display = 'flex';
    }

    function showError(field, message) {
        const errorElement = document.querySelector(`[data-for="${field}"]`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    function clearError(field) {
        const errorElement = document.querySelector(`[data-for="${field}"]`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    const validateField = (fieldName) => {
        const field = fields[fieldName];
        let isValid = false;
        let errorMessage = '';

        if (fieldName === 'confirmPassword') {
            isValid = field.validation(field.input.value);
            errorMessage = isValid ? '' : 'Şifreler eşleşmiyor.';
        } else if (fieldName === 'terms') {
            isValid = field.validation(field.input);
        } else {
            isValid = field.validation(field.input.value);
            if (fieldName === 'username') errorMessage = isValid ? '' : 'Kullanıcı adı en az 3 karakter olmalıdır.';
            if (fieldName === 'email') errorMessage = isValid ? '' : 'Geçersiz e-posta adresi.';
            if (fieldName === 'password') errorMessage = isValid ? '' : 'Şifre en az 8 karakter olmalıdır.';
        }

        if (field.error) {
            field.error.textContent = errorMessage;
            field.error.style.display = errorMessage ? 'block' : 'none';
        }

        return isValid;
    };

    const validateForm = () => {
        const isFormValid = Object.keys(fields).every(validateField);
        submitBtn.disabled = !isFormValid;
        return isFormValid;
    };

    Object.values(fields).forEach(field => {
        if (field.input && field.input.type === 'checkbox') {
            field.input.addEventListener('change', validateForm);
        } else if (field.input) {
            field.input.addEventListener('input', () => {
                validateField(field.input.name);
                if (field.input.name === 'password') {
                    validateField('confirmPassword');
                }
                validateForm();
            });
        }
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            return; // Form geçerli değilse işlemi durdur
        }

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Kaydediliyor...';

        // Genel hata mesajını temizle
        clearError('username');

        try {
            let finalAvatarUrl = null;

            // 1. Adım: Eğer avatar seçildiyse Cloudinary'ye yükle
            if (avatarFile) {
                try {
                    // Cloudinary API bilgilerinin doğru ayarlanıp ayarlanmadığını kontrol et
                    if (CLOUDINARY_CLOUD_NAME === 'your_cloud_name' || CLOUDINARY_UPLOAD_PRESET === 'your_upload_preset') {
                        console.warn('Cloudinary API bilgileri ayarlanmamış. Avatar yükleme atlanıyor ve varsayılan avatar kullanılacak.');
                        throw new Error('Cloudinary API bilgileri ayarlanmamış');
                    }

                    console.log('Cloudinary\'ye avatar yükleniyor...');
                    console.log('URL:', CLOUDINARY_URL);
                    console.log('Upload Preset:', CLOUDINARY_UPLOAD_PRESET);

                    const formData = new FormData();
                    formData.append('file', avatarFile);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                    const response = await fetch(CLOUDINARY_URL, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        console.error('Cloudinary API Hatası:', errorData);
                        throw new Error(`Avatar yüklenemedi. Hata kodu: ${response.status}`);
                    }

                    const data = await response.json();
                    finalAvatarUrl = data.secure_url;
                    console.log('Avatar başarıyla yüklendi:', finalAvatarUrl);
                } catch (uploadError) {
                    console.error('Avatar yükleme hatası:', uploadError);
                    // Hata mesajını göster ama kayıt işlemini durdurma
                    showError('avatar', 'Avatar yüklenemedi. Varsayılan avatar kullanılacak.');
                    // Avatar yüklenemediğinde varsayılan avatar kullanılacak, finalAvatarUrl null kalacak
                }
            }

            // 2. Adım: Eğer avatar yoksa veya yüklenemediyse varsayılan bir avatar seç
            if (!finalAvatarUrl) {
                const randomIndex = Math.floor(Math.random() * defaultAvatarFiles.length);
                const randomAvatarPath = defaultAvatarFiles[randomIndex];
                finalAvatarUrl = new URL(randomAvatarPath, window.location.origin).href;
                console.log('Varsayılan avatar atandı:', finalAvatarUrl);
            }

            // 3. Adım: Supabase'e kayıt ol
            const { data, error } = await supabase.auth.signUp({
                email: fields.email.input.value,
                password: fields.password.input.value,
                options: {
                    data: {
                        username: fields.username.input.value,
                        avatar_url: finalAvatarUrl // Avatar URL'sini kullanıcı meta verisine ekle
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Başarılı kayıt
            alert('Kayıt başarılı! Lütfen e-posta adresinize gönderilen onay linkine tıklayarak hesabınızı doğrulayın.');
            window.location.href = '/login.html'; // Giriş sayfasına yönlendir

        } catch (error) {
            console.error('Kayıt sırasında hata:', error);
            showError('username', `Kayıt başarısız: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'Hesap Oluştur';
        }
    });

    validateForm(); // Sayfa yüklendiğinde butonun durumunu ayarla
}); 