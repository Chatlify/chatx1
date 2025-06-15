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