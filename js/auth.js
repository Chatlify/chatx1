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

    // Şifre gücü kontrolü için elementler
    const strengthMeter = document.querySelector('.strength-meter');
    const strengthValue = document.getElementById('strength-value');

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
                // Supabase ile kayıt ol
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            username: username
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
});
