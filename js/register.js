import { supabase } from './auth_config.js';

// Cloudinary Settings
// You need to get these values from your own Cloudinary account:
// 1. Go to https://cloudinary.com and create a free account
// 2. Go to Dashboard and get your Cloud name (e.g., "your_cloud_name")
// 3. Go to Settings > Upload > Upload presets and create an "unsigned" preset
// 4. Enter the name of your preset below (e.g., "your_upload_preset")
const CLOUDINARY_CLOUD_NAME = 'dxr8bxvbp'; // Cloud name from Cloudinary dashboard
const CLOUDINARY_UPLOAD_PRESET = 'chatlify_users'; // Unsigned upload preset name
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const submitBtn = document.getElementById('submitBtn');
    const formErrors = document.querySelectorAll('.form-error');
    const stepIndicator = document.querySelector('.step-indicator');
    const stepSubtitle = document.getElementById('stepSubtitle');
    const steps = document.querySelectorAll('.step');
    const stepConnectors = document.querySelectorAll('.step-connector');
    const stepContents = document.querySelectorAll('.step-content');
    const nextButtons = document.querySelectorAll('.next-step-btn');
    const prevButtons = document.querySelectorAll('.prev-step-btn');

    let currentStep = 1;
    const stepSubtitles = [
        "Choose an awesome username that represents you!",
        "Add your email to secure your account",
        "Show yourself! Add a great profile picture",
        "Create a strong password to protect your account",
        "Almost done! Just one more step"
    ];

    // Avatar elements
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreviewImg = document.querySelector('.avatar-preview-img');
    const avatarPreviewText = document.querySelector('.avatar-preview-text');
    let avatarFile = null;

    // Default avatar file names
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

    // Avatar upload functionality
    avatarPreview.addEventListener('click', () => {
        avatarInput.click();
    });

    avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            // File type and size check
            const allowedTypes = ['image/png', 'image/jpeg', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                showError('avatar', 'Invalid file type. Please select PNG, JPG or GIF.');
                avatarFile = null;
                resetAvatarPreview();
                return;
            }

            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                showError('avatar', 'File size exceeds 5MB limit.');
                avatarFile = null;
                resetAvatarPreview();
                return;
            }

            // Store the file and show preview
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

    // Step functionality
    nextButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextStep = parseInt(btn.getAttribute('data-next'));
            if (validateStep(currentStep)) {
                goToStep(nextStep);
            }
        });
    });

    prevButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const prevStep = parseInt(btn.getAttribute('data-prev'));
            goToStep(prevStep);
        });
    });

    function goToStep(step) {
        // Hide current step
        stepContents.forEach(content => {
            if (parseInt(content.getAttribute('data-step')) === currentStep) {
                content.style.display = 'none';
            }
        });

        // Update step indicator
        steps.forEach(stepEl => {
            const stepNum = parseInt(stepEl.getAttribute('data-step'));
            if (stepNum < step) {
                stepEl.classList.add('completed');
                stepEl.classList.remove('active');
            } else if (stepNum === step) {
                stepEl.classList.add('active');
                stepEl.classList.remove('completed');
            } else {
                stepEl.classList.remove('active', 'completed');
            }
        });

        // Update connectors
        stepConnectors.forEach((connector, index) => {
            if (index < step - 1) {
                connector.classList.add('active');
            } else {
                connector.classList.remove('active');
            }
        });

        // Show new step and update subtitle
        currentStep = step;
        stepSubtitle.textContent = stepSubtitles[currentStep - 1];

        stepContents.forEach(content => {
            if (parseInt(content.getAttribute('data-step')) === currentStep) {
                content.style.display = 'block';

                // Find first input and focus
                const firstInput = content.querySelector('input');
                if (firstInput) {
                    setTimeout(() => {
                        firstInput.focus();
                    }, 300);
                }
            }
        });

        // Check all fields on the last step
        if (currentStep === 5) {
            validateForm();
        }
    }

    function validateStep(step) {
        let isValid = true;

        // Custom validation for each step
        if (step === 1) {
            isValid = validateField('username');
        } else if (step === 2) {
            isValid = validateField('email');
        } else if (step === 3) {
            // Avatar step is optional, so always valid
            isValid = true;
        } else if (step === 4) {
            isValid = validateField('password') && validateField('confirmPassword');
        }

        return isValid;
    }

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
            errorMessage = isValid ? '' : 'Passwords do not match.';
        } else if (fieldName === 'terms') {
            isValid = field.validation(field.input);
        } else {
            isValid = field.validation(field.input.value);
            if (fieldName === 'username') errorMessage = isValid ? '' : 'Username must be at least 3 characters.';
            if (fieldName === 'email') errorMessage = isValid ? '' : 'Invalid email address.';
            if (fieldName === 'password') errorMessage = isValid ? '' : 'Password must be at least 8 characters.';
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

    // User interaction field validations
    Object.values(fields).forEach(field => {
        if (field.input && field.input.type === 'checkbox') {
            field.input.addEventListener('change', validateForm);
        } else if (field.input) {
            field.input.addEventListener('input', () => {
                validateField(field.input.name);
                if (field.input.name === 'password') {
                    validateField('confirmPassword');
                }

                if (currentStep === 5) {
                    validateForm();
                }
            });
        }
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateForm()) {
            return; // Stop if form is not valid
        }

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = 'Creating...';

        // Clear general error message
        clearError('username');

        try {
            let finalAvatarUrl = null;

            // Step 1: Upload avatar to Cloudinary if selected
            if (avatarFile) {
                try {
                    // Check if Cloudinary API details are properly set
                    if (CLOUDINARY_CLOUD_NAME === 'your_cloud_name' || CLOUDINARY_UPLOAD_PRESET === 'your_upload_preset') {
                        console.warn('Cloudinary API details not set. Skipping avatar upload and using default avatar.');
                        throw new Error('Cloudinary API details not set');
                    }

                    console.log('Uploading avatar to Cloudinary...');
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
                        console.error('Cloudinary API Error:', errorData);
                        throw new Error(`Could not upload avatar. Error code: ${response.status}`);
                    }

                    const data = await response.json();
                    finalAvatarUrl = data.secure_url;
                    console.log('Avatar uploaded successfully:', finalAvatarUrl);
                } catch (uploadError) {
                    console.error('Avatar upload error:', uploadError);
                    // Show error message but don't stop registration
                    showError('avatar', 'Could not upload avatar. Default avatar will be used.');
                    // Default avatar will be used if upload fails, finalAvatarUrl remains null
                }
            }

            // Step 2: If no avatar or upload failed, select a default avatar
            if (!finalAvatarUrl) {
                const randomIndex = Math.floor(Math.random() * defaultAvatarFiles.length);
                const randomAvatarPath = defaultAvatarFiles[randomIndex];
                finalAvatarUrl = new URL(randomAvatarPath, window.location.origin).href;
                console.log('Default avatar assigned:', finalAvatarUrl);
            }

            // Step 3: Register with Supabase
            const { data, error } = await supabase.auth.signUp({
                email: fields.email.input.value,
                password: fields.password.input.value,
                options: {
                    data: {
                        username: fields.username.input.value,
                        avatar_url: finalAvatarUrl // Add avatar URL to user metadata
                    }
                }
            });

            if (error) {
                throw error;
            }

            // Successful registration
            alert('Registration successful! Please click the confirmation link sent to your email to verify your account.');
            window.location.href = '/login.html'; // Redirect to login page

        } catch (error) {
            console.error('Registration error:', error);
            showError('username', `Registration failed: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn-text').textContent = 'Create My Account';
        }
    });

    // Go to first step when page loads
    goToStep(1);
}); 