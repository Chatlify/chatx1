/**
 * Sunucu Ekle/Katıl Modalının tüm işlevselliğini başlatan ana fonksiyon.
 */
export function initServerModal() {
    console.log('Initializing server modal component');
    // Use the component's init method
    ServerModalComponent.init();
}

// Server Modal Component
const ServerModalComponent = (() => {
    // DOM Elements
    let currentStep = 1;
    let serverIcon = null;
    let selectedCategory = null;

    // Initialize the component
    function init() {
        setupEventListeners();
        console.log('Server Modal Component initialized');
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Server icon upload
        const iconUpload = document.querySelector('.upload-preview');
        const iconInput = document.getElementById('server-icon-input');

        if (iconUpload && iconInput) {
            iconUpload.addEventListener('click', () => {
                iconInput.click();
            });

            iconInput.addEventListener('change', handleIconUpload);
        }

        // Category selection
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                // Remove selected state from all items
                categoryItems.forEach(i => i.classList.remove('selected'));
                // Add selected state to clicked item
                item.classList.add('selected');
                // Store selected category
                selectedCategory = item.getAttribute('data-category');
            });
        });

        // Navigation buttons
        const backButton = document.getElementById('btn-back');
        const nextButton = document.getElementById('btn-next');
        const createButton = document.getElementById('btn-create');

        if (backButton) {
            backButton.addEventListener('click', handleBackClick);
        }

        if (nextButton) {
            nextButton.addEventListener('click', handleNextClick);
        }

        if (createButton) {
            createButton.addEventListener('click', handleCreateServer);
        }

        // Show server options
        const showServerOptionsBtn = document.getElementById('add-server-btn');
        const serverOptionsModal = document.getElementById('server-options-modal');

        if (showServerOptionsBtn && serverOptionsModal) {
            showServerOptionsBtn.addEventListener('click', () => {
                serverOptionsModal.style.display = 'flex';
            });
        }

        // Close server options modal
        const closeServerOptions = document.querySelector('.server-options-modal .close-modal');
        if (closeServerOptions && serverOptionsModal) {
            closeServerOptions.addEventListener('click', () => {
                serverOptionsModal.style.display = 'none';
            });
        }

        // Server create option
        const serverCreateOption = document.getElementById('server-create-option');
        const serverCreateForm = document.getElementById('server-create-form');

        if (serverCreateOption && serverCreateForm && serverOptionsModal) {
            serverCreateOption.addEventListener('click', () => {
                serverOptionsModal.style.display = 'none';
                serverCreateForm.style.display = 'flex';
                resetForm();
            });
        }
    }

    // Handle icon upload
    function handleIconUpload(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const iconPreview = document.getElementById('server-icon-img');
                if (iconPreview) {
                    iconPreview.src = e.target.result;
                    serverIcon = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    // Handle back button click
    function handleBackClick() {
        if (currentStep > 1) {
            navigateToStep(currentStep - 1);
        } else {
            // Go back to server options modal
            const serverCreateForm = document.getElementById('server-create-form');
            const serverOptionsModal = document.getElementById('server-options-modal');

            if (serverCreateForm && serverOptionsModal) {
                serverCreateForm.style.display = 'none';
                serverOptionsModal.style.display = 'flex';
            }
        }
    }

    // Handle next button click
    function handleNextClick() {
        if (validateCurrentStep()) {
            if (currentStep < 3) {
                navigateToStep(currentStep + 1);
            }
        }
    }

    // Validate current step
    function validateCurrentStep() {
        switch (currentStep) {
            case 1:
                const serverNameInput = document.getElementById('server-name-input');
                if (!serverNameInput || !serverNameInput.value.trim()) {
                    alert('Lütfen bir sunucu adı girin.');
                    return false;
                }
                return true;
            case 2:
                if (!selectedCategory) {
                    alert('Lütfen bir kategori seçin.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    // Navigate to a specific step
    function navigateToStep(step) {
        // Update step indicator
        const steps = document.querySelectorAll('.step');
        const stepLines = document.querySelectorAll('.step-line');

        steps.forEach((item, index) => {
            if (index + 1 < step) {
                item.classList.remove('active');
                item.classList.add('completed');
            } else if (index + 1 === step) {
                item.classList.add('active');
                item.classList.remove('completed');
            } else {
                item.classList.remove('active', 'completed');
            }
        });

        // Update step line indicators
        stepLines.forEach((line, index) => {
            if (index + 1 < step) {
                line.classList.add('completed');
            } else {
                line.classList.remove('completed');
            }
        });

        // Hide all form steps
        const formSteps = document.querySelectorAll('.form-step');
        formSteps.forEach(form => {
            form.classList.remove('active');
        });

        // Show current form step
        const currentFormStep = document.getElementById(`step-${step}`);
        if (currentFormStep) {
            currentFormStep.classList.add('active');
        }

        // Update navigation buttons
        const backButton = document.getElementById('btn-back');
        const nextButton = document.getElementById('btn-next');
        const createButton = document.getElementById('btn-create');

        if (step === 1) {
            backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Vazgeç';
        } else {
            backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Geri';
        }

        if (step === 3) {
            nextButton.style.display = 'none';
            createButton.style.display = 'flex';
            updateSummary();
        } else {
            nextButton.style.display = 'flex';
            createButton.style.display = 'none';
        }

        // Update current step
        currentStep = step;
    }

    // Update summary
    function updateSummary() {
        const serverNameInput = document.getElementById('server-name-input');
        const summaryName = document.getElementById('summary-name');
        const summaryCategory = document.getElementById('summary-category');
        const summaryIcon = document.getElementById('summary-icon');

        if (serverNameInput && summaryName) {
            summaryName.textContent = serverNameInput.value;
        }

        if (summaryCategory) {
            const categoryMap = {
                'gaming': 'Oyun',
                'music': 'Müzik',
                'education': 'Eğitim',
                'technology': 'Teknoloji',
                'art': 'Sanat',
                'community': 'Topluluk'
            };
            summaryCategory.textContent = selectedCategory ? categoryMap[selectedCategory] : '-';
        }

        if (summaryIcon && serverIcon) {
            summaryIcon.src = serverIcon;
        }
    }

    // Handle create server
    function handleCreateServer() {
        const serverNameInput = document.getElementById('server-name-input');
        if (!serverNameInput || !serverNameInput.value.trim()) {
            alert('Lütfen bir sunucu adı girin.');
            return;
        }

        if (!selectedCategory) {
            alert('Lütfen bir kategori seçin.');
            return;
        }

        // Create server data
        const serverData = {
            name: serverNameInput.value,
            icon: serverIcon || 'images/DefaultServerIcon.png',
            category: selectedCategory
        };

        // Here you would typically send this data to a server
        console.log('Sunucu oluşturuluyor:', serverData);

        // Close the modal and show success message
        alert(`"${serverData.name}" sunucusu başarıyla oluşturuldu!`);

        // Reset and hide form
        const serverCreateForm = document.getElementById('server-create-form');
        if (serverCreateForm) {
            serverCreateForm.style.display = 'none';
        }

        // TODO: Add the new server to the server list
    }

    // Reset form to initial state
    function resetForm() {
        // Reset fields
        const serverNameInput = document.getElementById('server-name-input');
        if (serverNameInput) {
            serverNameInput.value = '';
        }

        // Reset icon
        const iconPreview = document.getElementById('server-icon-img');
        if (iconPreview) {
            iconPreview.src = 'images/DefaultServerIcon.png';
        }
        serverIcon = null;

        // Reset category selection
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            item.classList.remove('selected');
        });
        selectedCategory = null;

        // Reset to first step
        navigateToStep(1);
    }

    return {
        init
    };
})();

// Initialize when DOM loads if needed outside the export
document.addEventListener('DOMContentLoaded', ServerModalComponent.init); 