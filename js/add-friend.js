document.addEventListener('DOMContentLoaded', () => {
    const modalContainer = document.getElementById('add-friend-modal-container');
    const addFriendButton = document.getElementById('add-friend-button');

    if (!modalContainer || !addFriendButton) {
        console.error('Arkadaş ekleme modülü için gerekli HTML elementleri bulunamadı.');
        return;
    }

    // Modal HTML'ini yükle
    fetch('add-friend.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.text();
        })
        .then(html => {
            modalContainer.innerHTML = html;
            // HTML yüklendikten sonra olay dinleyicilerini kur
            setupModalEventListeners();
        })
        .catch(error => console.error('Arkadaş ekleme modal HTML yüklenirken hata:', error));

    function setupModalEventListeners() {
        // Elementleri, global document yerine modal konteynerı içinde arıyoruz.
        const modalOverlay = document.getElementById('add-friend-modal');
        if (!modalOverlay) {
            console.error('Modal overlay elementi (#add-friend-modal) bulunamadı.');
            return;
        }

        const modalContainer = modalOverlay.querySelector('.modal-container');
        const closeModalButton = modalOverlay.querySelector('.close-modal-btn');
        const addFriendForm = modalOverlay.querySelector('#add-friend-form');
        const usernameInput = modalOverlay.querySelector('#add-friend-username-input');
        const statusMessage = modalOverlay.querySelector('#friend-request-status');

        // Elementlerin bulunup bulunmadığını daha sağlam bir şekilde kontrol et
        if (!modalContainer || !closeModalButton || !addFriendForm || !usernameInput || !statusMessage) {
            console.error('Modal içindeki alt elementlerden biri veya birkaçı bulunamadı.', {
                modalContainer,
                closeModalButton,
                addFriendForm,
                usernameInput,
                statusMessage
            });
            return;
        }

        const openModal = () => {
            document.body.style.overflow = 'hidden'; // Arka planın kaydırılmasını engelle
            modalOverlay.style.display = 'flex';

            // Kısa bir gecikme sonrası active sınıfını ekle (CSS geçişi için)
            setTimeout(() => {
                modalOverlay.classList.add('active');
                usernameInput.focus(); // Input alanına odaklan
            }, 10);
        };

        const closeModal = () => {
            modalOverlay.classList.remove('active');

            // Animasyon süresi kadar bekleyip modalı gizle
            setTimeout(() => {
                modalOverlay.style.display = 'none';
                document.body.style.overflow = ''; // Kaydırmayı geri aç

                // Formu ve durum mesajını sıfırla
                addFriendForm.reset();
                clearStatusMessage();
            }, 300);
        };

        const clearStatusMessage = () => {
            statusMessage.className = 'status-message';
            statusMessage.textContent = '';
        };

        // Klavye erişilebilirliği için Enter tuşu ile buton tıklatma özelliği
        closeModalButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                closeModal();
            }
        });

        addFriendButton.addEventListener('click', openModal);
        closeModalButton.addEventListener('click', closeModal);

        // Klavye kontrolü - ESC tuşu ile modalı kapatma
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modalOverlay.classList.contains('active')) {
                closeModal();
            }
        });

        modalOverlay.addEventListener('click', (event) => {
            // Sadece overlay'in kendisine tıklandığında kapat
            if (event.target === modalOverlay) {
                closeModal();
            }
        });

        addFriendForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const fullUsername = usernameInput.value.trim();

            if (!fullUsername || !fullUsername.includes('#')) {
                showStatus('Lütfen geçerli bir kullanıcı adı ve etiket girin (örn: kullanici#1234).', 'error');
                return;
            }

            if (typeof sendFriendRequest === 'function') {
                try {
                    // Gönder butonunu devre dışı bırak ve yükleniyor göster
                    const submitButton = addFriendForm.querySelector('.send-request-btn');
                    const originalText = submitButton.innerHTML;

                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

                    await sendFriendRequest(fullUsername);

                    // Butonu eski haline getir
                    submitButton.innerHTML = originalText;
                    submitButton.disabled = false;

                    showStatus(`'${fullUsername}' kişisine arkadaşlık isteği gönderildi!`, 'success');

                    setTimeout(() => {
                        closeModal();
                    }, 2000);

                } catch (error) {
                    const submitButton = addFriendForm.querySelector('.send-request-btn');
                    submitButton.innerHTML = originalText;
                    submitButton.disabled = false;

                    showStatus(error.message || 'İstek gönderilirken bir hata oluştu.', 'error');
                }
            } else {
                console.error('`sendFriendRequest` fonksiyonu bulunamadı. dashboard.js yüklendiğinden emin olun.');
                showStatus('Arkadaş ekleme sistemi şu an kullanılamıyor.', 'error');
            }
        });

        function showStatus(message, type) {
            // Önce mevcut durum mesajını temizle
            clearStatusMessage();

            // Küçük bir gecikmeyle yeni mesajı göster (animasyon için)
            setTimeout(() => {
                statusMessage.textContent = message;
                statusMessage.className = `status-message ${type}`; // 'success' veya 'error'
            }, 10);
        }
    }
}); 