/**
 * Arkadaş Ekle Modalının tüm işlevselliğini başlatan ana fonksiyon.
 * Bu fonksiyon, modalın açma/kapama düğmelerini ve form gönderim mantığını ayarlar.
 */
export function initAddFriendModal() {
    // "Arkadaş Ekle" modalını yönetmek için genel modal kurulumunu kullan.
    // Bu, tetikleyici butona, modalın kendisine ve kapatma düğmesine olay dinleyicileri ekler.
    setupModal('#add-friend-button', '#add-friend-modal', '.close-modal-btn');

    // Arkadaş ekleme formunun gönderim (submit) olayını yöneten fonksiyonu kur.
    setupAddFriendForm();
}


/**
 * Bir modal penceresinin açma, kapama ve dışına tıklama gibi temel
 * işlevlerini kuran yeniden kullanılabilir bir yardımcı fonksiyon.
 * @param {string} triggerSelector - Modalı açacak olan düğmenin CSS seçicisi.
 * @param {string} modalSelector - Modalın ana konteynerinin CSS seçicisi.
 * @param {string} closeSelector - Modal içindeki kapatma düğmesinin CSS seçicisi.
 */
function setupModal(triggerSelector, modalSelector, closeSelector) {
    const trigger = document.querySelector(triggerSelector);
    const modal = document.querySelector(modalSelector);

    if (!trigger || !modal) {
        console.warn(`Modal kurulumu için elementler bulunamadı:`, { trigger: triggerSelector, modal: modalSelector });
        return;
    }

    const closeButton = modal.querySelector(closeSelector);

    const openModal = () => {
        if (modal) modal.classList.add('active');
    }

    const closeModal = () => {
        if (modal) modal.classList.remove('active');
    }

    if (trigger) {
        trigger.addEventListener('click', openModal);
    }

    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    // Modal dışına tıklayarak kapatma
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // ESC tuşu ile kapatma
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
}

/**
 * Arkadaş Ekle formunun mantığını kurar. Form gönderildiğinde,
 * kullanıcı girdisini doğrular ve (simüle edilmiş) bir API çağrısı yapar.
 */
function setupAddFriendForm() {
    const addFriendForm = document.getElementById('add-friend-form');
    if (addFriendForm) {
        addFriendForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const usernameInput = document.getElementById('add-friend-username-input');
            const messageArea = document.querySelector('#add-friend-modal .modal-message-area');
            const modal = document.getElementById('add-friend-modal');

            if (!usernameInput || !messageArea || !modal) {
                console.error("Arkadaş ekleme formu elemanları bulunamadı.");
                return;
            }

            const usernameWithTag = usernameInput.value.trim();
            messageArea.style.display = 'none';
            messageArea.textContent = '';

            const tagRegex = /^.+#\d{4}$/;
            if (usernameWithTag && tagRegex.test(usernameWithTag)) {
                try {
                    console.log(`Arkadaşlık isteği gönderiliyor: ${usernameWithTag}`);

                    messageArea.textContent = `"${usernameWithTag}" kişisine arkadaşlık isteği gönderildi!`;
                    messageArea.className = 'modal-message-area success';
                    messageArea.style.display = 'block';
                    usernameInput.value = '';

                    setTimeout(() => {
                        modal.classList.remove('active');
                    }, 2000);

                } catch (error) {
                    messageArea.textContent = `Bir hata oluştu: ${error.message}`;
                    messageArea.className = 'modal-message-area error';
                    messageArea.style.display = 'block';
                }
            } else {
                messageArea.textContent = 'Lütfen geçerli bir kullanıcı adı ve etiket girin (örn: Kullanici#1234).';
                messageArea.className = 'modal-message-area error';
                messageArea.style.display = 'block';
            }
        });
    } else {
        console.warn("Arkadaş ekleme formu (add-friend-form) bulunamadı.");
    }
} 