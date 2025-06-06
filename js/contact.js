import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Animated entrance effects
    animateOnScroll();
    setupContactForm();
    setupNotificationToast();

    // Setup form and add listeners
    function setupContactForm() {
        const contactForm = document.getElementById('contactForm');

        if (!contactForm) return;

        const formGroups = document.querySelectorAll('.form-group');

        // Add animation index to form group elements
        formGroups.forEach((group, index) => {
            group.style.setProperty('--item-index', index);
        });

        const submitBtn = document.querySelector('.submit-btn');

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validate form
            if (!validateForm(contactForm)) return;

            // Show form submission animation
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Submitting...';

            try {
                await submitContactForm(contactForm);

                // Show notification
                showNotification('Your message has been sent successfully!', 'success');

                // Clear form
                contactForm.reset();

            } catch (error) {
                console.error('Form submission error:', error);
                showNotification('An error occurred while sending your message. Please try again.', 'error');
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        });
    }

    // Form field validation
    function validateForm(form) {
        const nameInput = form.querySelector('#name');
        const emailInput = form.querySelector('#email');
        const subjectSelect = form.querySelector('#subject');
        const messageTextarea = form.querySelector('#message');
        const privacyCheckbox = form.querySelector('#privacy');

        let isValid = true;

        // Clear current validation errors
        clearValidationErrors();

        // Name check
        if (!nameInput.value.trim()) {
            showValidationError(nameInput, 'Please enter your name');
            isValid = false;
        }

        // Email check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
            showValidationError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }

        // Subject check
        if (subjectSelect.value === '') {
            showValidationError(subjectSelect, 'Please select a subject');
            isValid = false;
        }

        // Message check
        if (!messageTextarea.value.trim() || messageTextarea.value.trim().length < 10) {
            showValidationError(messageTextarea, 'Please enter a message with at least 10 characters');
            isValid = false;
        }

        // Privacy policy check
        if (!privacyCheckbox.checked) {
            showValidationError(privacyCheckbox, 'You must accept the privacy policy to continue');
            isValid = false;
        }

        return isValid;
    }

    // Show validation error
    function showValidationError(inputElement, errorMessage) {
        const formGroup = inputElement.closest('.form-group');

        // Add error message
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = errorMessage;

        // Add error message if not exists
        if (!formGroup.querySelector('.validation-error')) {
            formGroup.appendChild(errorElement);
        }

        // Add error style to input
        inputElement.classList.add('error');

        // Special handling for checkbox
        if (inputElement.type === 'checkbox') {
            inputElement.parentElement.classList.add('checkbox-error');
        }
    }

    // Clear validation errors
    function clearValidationErrors() {
        // Remove error messages
        document.querySelectorAll('.validation-error').forEach(el => el.remove());

        // Remove error styles
        document.querySelectorAll('input.error, textarea.error, select.error').forEach(el => {
            el.classList.remove('error');
        });

        // Remove checkbox error style
        document.querySelectorAll('.checkbox-error').forEach(el => {
            el.classList.remove('checkbox-error');
        });
    }

    // Submit form data to Supabase
    async function submitContactForm(form) {
        const formData = new FormData(form);

        const formPayload = {
            name: sanitizeInput(formData.get('name')),
            email: sanitizeInput(formData.get('email')),
            subject: sanitizeInput(formData.get('subject')),
            message: sanitizeInput(formData.get('message')),
            created_at: new Date().toISOString()
        };

        // Send to Supabase
        const { data, error } = await supabase
            .from('contact_messages')
            .insert([formPayload]);

        if (error) {
            console.error('Supabase error:', error);
            throw new Error('Error saving message');
        }

        return data;
    }

    // Sanitize input for XSS protection
    function sanitizeInput(input) {
        if (!input) return '';
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    // Notification toast setup
    function setupNotificationToast() {
        const closeBtn = document.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideNotification);
        }
    }

    // Show notification
    function showNotification(message, type = 'success') {
        const toast = document.getElementById('notificationToast');
        const messageElement = toast.querySelector('.notification-message');
        const iconElement = toast.querySelector('.notification-icon i');

        messageElement.textContent = message;

        // Change icon based on type
        iconElement.className = type === 'success'
            ? 'fas fa-check-circle'
            : 'fas fa-exclamation-circle';

        // Toast type
        toast.className = 'notification-toast ' + type;

        // Show
        toast.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideNotification();
        }, 5000);
    }

    // Hide notification
    function hideNotification() {
        const toast = document.getElementById('notificationToast');
        toast.classList.remove('show');
    }

    // Scroll animation
    function animateOnScroll() {
        const infoCards = document.querySelectorAll('.info-card');

        // Add animation index to info cards
        infoCards.forEach((card, index) => {
            card.style.setProperty('--item-index', index);
        });
    }

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuToggle && navLinks) {
        mobileMenuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
        });
    }
}); 