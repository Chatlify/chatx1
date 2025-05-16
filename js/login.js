import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', function () {
    // Form elementlerini seç
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessageElement = document.getElementById('error-message');
    const loginButton = document.getElementById('login-button');

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
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Buton yükleniyor durumuna getir
            loginButton.disabled = true;
            loginButton.innerHTML = '<div class="spinner"></div>';

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Basit form doğrulama
            if (!email || !password) {
                showError('E-posta ve şifre gereklidir.');
                loginButton.disabled = false;
                loginButton.innerHTML = 'Giriş Yap';
                return;
            }

            try {
                // Supabase ile giriş yap
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    throw error;
                }

                // Giriş başarılı
                localStorage.setItem('userLoggedIn', 'true');
                window.location.href = 'dashboard.html';

            } catch (error) {
                console.error('Giriş hatası:', error);

                // Kullanıcı dostu hata mesajları
                if (error.message.includes('Invalid login credentials')) {
                    showError('E-posta veya şifre hatalı.');
                } else if (error.message.includes('Email not confirmed')) {
                    showError('Lütfen e-posta adresinizi doğrulayın.');
                } else {
                    showError('Giriş yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
                }

                // Buton normal duruma getir
                loginButton.disabled = false;
                loginButton.innerHTML = 'Giriş Yap';
            }
        });
    }

    // Yardımcı fonksiyonlar ve olay dinleyiciler
    const togglePasswordButton = document.getElementById('toggle-password');
    if (togglePasswordButton) {
        togglePasswordButton.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePasswordButton.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }
}); 