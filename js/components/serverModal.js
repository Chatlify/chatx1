/**
 * Sunucu Ekle/Katıl Modalının tüm işlevselliğini başlatan ana fonksiyon.
 */
export function initServerModal() {
    // Genel modal açma/kapama davranışını kur
    setupModal('.server-add-icon', '#server-modal', '.close-server-modal-btn');

    // Modal içindeki ana seçenekler (Oluştur/Katıl) ve çok adımlı form mantığını kur
    setupServerPanelTabsAndSteps();
}


/**
 * Bir modal penceresinin açma, kapama ve temel davranışlarını kurar.
 * @param {string} triggerSelector - Modalı açacak olan düğmenin CSS seçicisi.
 * @param {string} modalSelector - Modalın ana konteynerinin CSS seçicisi.
 * @param {string} closeSelector - Modal içindeki kapatma düğmesinin CSS seçicisi.
 */
function setupModal(triggerSelector, modalSelector, closeSelector) {
    const trigger = document.querySelector(triggerSelector);
    const modal = document.querySelector(modalSelector);

    if (!trigger || !modal) {
        console.warn(`Sunucu modalı için elementler bulunamadı:`, { trigger, modal });
        return;
    }

    const closeButton = modal.querySelector(closeSelector);

    const openModal = () => modal.classList.add('active');
    const closeModal = () => {
        modal.classList.remove('active');
        // Modal kapandığında formu sıfırla
        resetMultiStepForm(modal);
    };

    trigger.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });
}

/**
 * Modalın ana mantığını yönetir:
 * 1. "Oluştur" ve "Katıl" seçenekleri arasındaki geçişi sağlar.
 * 2. "Oluştur" seçeneği için çok adımlı formun (stepper) mantığını kurar.
 */
function setupServerPanelTabsAndSteps() {
    const modal = document.getElementById('server-modal');
    if (!modal) return;

    // Ana Seçenekler
    const createOption = modal.querySelector('#server-option-create');
    const joinOption = modal.querySelector('#server-option-join');
    const createFormContainer = modal.querySelector('#server-create-form');
    const joinForm = modal.querySelector('#server-join-form');
    const optionsContainer = modal.querySelector('.server-options-container');

    // Çok Adımlı Form Elementleri
    const stepperItems = modal.querySelectorAll('.step-item');
    const formSteps = modal.querySelectorAll('.form-step');
    const nextBtn = modal.querySelector('#next-step-btn');
    const finalCreateBtn = modal.querySelector('#create-server-final-btn');
    const backBtn = modal.querySelector('.form-navigation .back-to-options-btn'); // Artık "Geri" ve "Vazgeç" işlevi görüyor

    // Form Veri Elementleri
    const serverNameInput = modal.querySelector('#server-name-input');
    const serverIconInput = modal.querySelector('#server-icon-upload-input');
    const serverIconPreview = modal.querySelector('#server-icon-preview-img');
    const categoryOptions = modal.querySelectorAll('.category-option');

    // Özet Ekranı Elementleri
    const summaryServerName = modal.querySelector('#summary-server-name');
    const summaryCategory = modal.querySelector('#summary-category');
    const summaryIconPreview = modal.querySelector('#summary-icon-preview');

    // Form Verilerini Saklama Nesnesi
    const formData = {
        serverName: '',
        serverIconURL: 'images/DefaultServerIcon.png',
        selectedCategory: ''
    };

    let currentStep = 1;

    // --- Ana Seçenekler Arası Geçiş ---
    createOption.addEventListener('click', () => {
        optionsContainer.style.display = 'none';
        createFormContainer.style.display = 'block';
        goToStep(1); // Oluşturma formunu her zaman 1. adımdan başlat
    });

    joinOption.addEventListener('click', () => {
        optionsContainer.style.display = 'none';
        joinForm.style.display = 'block';
    });

    // --- Sunucu İkonu Yükleme İşlevselliği ---
    const serverIconPreviewContainer = modal.querySelector('.server-icon-preview');
    if (serverIconPreviewContainer && serverIconInput) {
        serverIconPreviewContainer.addEventListener('click', () => {
            serverIconInput.click();
        });

        serverIconInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    serverIconPreview.src = event.target.result;
                    formData.serverIconURL = event.target.result; // Form verisini güncelle

                    // Özet sayfasındaki ikonu da güncelle
                    if (summaryIconPreview) {
                        summaryIconPreview.src = event.target.result;
                    }
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
    }

    // --- Kategori Seçim İşlevselliği ---
    categoryOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Önceki seçimi temizle
            categoryOptions.forEach(opt => opt.classList.remove('selected'));
            // Yeni seçimi işaretle
            option.classList.add('selected');
            // Seçilen kategoriyi kaydet
            formData.selectedCategory = option.querySelector('.category-name').textContent;
        });
    });

    // --- Çok Adımlı Form Mantığı ---
    const goToStep = (stepNumber) => {
        // Doğrulama işlemi
        if (stepNumber > currentStep) {
            if (currentStep === 1) {
                // Adım 1 doğrulama: Sunucu adı girilmiş mi?
                if (!serverNameInput.value.trim()) {
                    alert('Lütfen bir sunucu adı girin.');
                    serverNameInput.focus();
                    return;
                }

                // Form verilerini güncelle
                formData.serverName = serverNameInput.value.trim();
            }
            else if (currentStep === 2) {
                // Adım 2 doğrulama: Kategori seçilmiş mi?
                if (!formData.selectedCategory) {
                    alert('Lütfen bir kategori seçin.');
                    return;
                }
            }

            // Adım 3'e geçiliyorsa özet ekranını güncelle
            if (stepNumber === 3) {
                updateSummaryScreen();
            }
        }

        currentStep = stepNumber;

        // Form adımlarını güncelle
        formSteps.forEach(step => {
            step.classList.toggle('active', parseInt(step.dataset.stepContent) === currentStep);
        });

        // Stepper'ı güncelle
        stepperItems.forEach(item => {
            const step = parseInt(item.dataset.step);
            item.classList.remove('active', 'completed');
            if (step < currentStep) {
                item.classList.add('completed');
                item.querySelector('.step-circle').innerHTML = '<i class="fas fa-check"></i>';
            } else if (step === currentStep) {
                item.classList.add('active');
                item.querySelector('.step-circle').textContent = step;
            } else {
                item.querySelector('.step-circle').textContent = step;
            }
        });

        // Butonları güncelle
        if (currentStep === 1) {
            backBtn.querySelector('span').textContent = "Vazgeç";
        } else {
            backBtn.querySelector('span').textContent = "Geri";
        }

        nextBtn.style.display = currentStep === 3 ? 'none' : 'flex';
        finalCreateBtn.style.display = currentStep === 3 ? 'flex' : 'none';
    };

    // Özet ekranını güncelleme fonksiyonu
    const updateSummaryScreen = () => {
        if (summaryServerName) {
            summaryServerName.textContent = formData.serverName || '-';
        }
        if (summaryCategory) {
            summaryCategory.textContent = formData.selectedCategory || '-';
        }
        if (summaryIconPreview) {
            summaryIconPreview.src = formData.serverIconURL;
        }
    };

    // Buton olay dinleyicileri
    nextBtn.addEventListener('click', () => {
        if (currentStep < 3) {
            goToStep(currentStep + 1);
        }
    });

    backBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            goToStep(currentStep - 1);
        } else {
            // 1. adımdaysak ve "Vazgeç"e tıklarsak, ana seçeneklere dön
            createFormContainer.style.display = 'none';
            joinForm.style.display = 'none';
            optionsContainer.style.display = 'block';
        }
    });

    finalCreateBtn.addEventListener('click', async () => {
        try {
            // Sunucuyu oluşturma işlemi burada olacak
            // Şimdilik bir başarı mesajı gösterelim
            alert(`"${formData.serverName}" sunucusu başarıyla oluşturuldu!`);

            // Modal'ı kapat ve formu sıfırla
            modal.classList.remove('active');
            resetMultiStepForm(modal);
        } catch (error) {
            console.error('Sunucu oluşturulurken hata:', error);
            alert('Sunucu oluşturulurken bir hata oluştu.');
        }
    });
}

/**
 * Modalı kapatırken veya vazgeçerken formu başlangıç durumuna sıfırlar.
 */
function resetMultiStepForm(modal) {
    // Form elementlerini seç
    const createFormContainer = modal.querySelector('#server-create-form');
    const joinForm = modal.querySelector('#server-join-form');
    const optionsContainer = modal.querySelector('.server-options-container');
    const serverNameInput = modal.querySelector('#server-name-input');
    const serverIconPreview = modal.querySelector('#server-icon-preview-img');
    const categoryOptions = modal.querySelectorAll('.category-option');

    // Form verilerini temizle
    if (serverNameInput) serverNameInput.value = '';
    if (serverIconPreview) serverIconPreview.src = 'images/DefaultServerIcon.png';
    categoryOptions.forEach(opt => opt.classList.remove('selected'));

    // Formları ve seçenekleri başlangıç durumuna getir
    if (optionsContainer) optionsContainer.style.display = 'block';
    if (createFormContainer) createFormContainer.style.display = 'none';
    if (joinForm) joinForm.style.display = 'none';

    // Adım 1'i ve stepper'ı sıfırla
    modal.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    const firstStep = modal.querySelector('.form-step[data-step-content="1"]');
    if (firstStep) firstStep.classList.add('active');

    modal.querySelectorAll('.step-item').forEach((item, index) => {
        item.classList.remove('completed', 'active');
        if (index === 0) item.classList.add('active');
        const circle = item.querySelector('.step-circle');
        if (circle) circle.textContent = index + 1;
    });

    // Butonları sıfırla
    const nextBtn = modal.querySelector('#next-step-btn');
    const finalCreateBtn = modal.querySelector('#create-server-final-btn');
    const backBtn = modal.querySelector('.form-navigation .back-to-options-btn');

    if (backBtn) backBtn.querySelector('span').textContent = "Vazgeç";
    if (nextBtn) nextBtn.style.display = 'flex';
    if (finalCreateBtn) finalCreateBtn.style.display = 'none';
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
        // This would be implemented based on your specific application structure
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

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', ServerModalComponent.init); 