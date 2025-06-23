import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const formErrors = document.querySelectorAll('.form-error');

    const fields = {
        username: { input: document.getElementById('username'), error: document.querySelector('[data-for="username"]'), validation: (value) => value.length >= 3 },
        email: { input: document.getElementById('email'), error: document.querySelector('[data-for="email"]'), validation: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
        password: { input: document.getElementById('password'), error: document.querySelector('[data-for="password"]'), validation: (value) => value.length >= 8 },
        confirmPassword: { input: document.getElementById('confirmPassword'), error: document.querySelector('[data-for="confirmPassword"]'), validation: (value) => value === fields.password.input.value && value.length > 0 },
        terms: { input: document.getElementById('terms'), error: null, validation: (value) => value.checked }
    };

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
    };

    Object.values(fields).forEach(field => {
        if (field.input.type === 'checkbox') {
            field.input.addEventListener('change', validateForm);
        } else {
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
            // Buton zaten devre dışı olmalı, ama ekstra bir kontrol
            return;
        }

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Kaydediliyor...';

        // Genel hata mesajını temizle
        const generalError = document.querySelector('[data-for="username"]'); // İlk alana koyalım
        generalError.textContent = '';
        generalError.style.display = 'none';

        try {
            const { data, error } = await supabase.auth.signUp({
                email: fields.email.input.value,
                password: fields.password.input.value,
                options: {
                    data: {
                        username: fields.username.input.value
                        // Avatar URL'si burada GÖNDERİLMİYOR.
                        // Bu işlem artık veritabanı trigger'ı tarafından yapılacak.
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Kullanıcıya bir onay e-postası gönderildiğini bildir
            alert('Kayıt başarılı! Lütfen e-posta adresinize gönderilen onay linkine tıklayarak hesabınızı doğrulayın.');
            window.location.href = '/login.html'; // Giriş sayfasına yönlendir

        } catch (error) {
            console.error('Kayıt sırasında hata:', error);
            generalError.textContent = `Kayıt başarısız: ${error.message}`;
            generalError.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'Hesap Oluştur';
        }
    });

    validateForm(); // Sayfa yüklendiğinde butonun durumunu ayarla
}); 