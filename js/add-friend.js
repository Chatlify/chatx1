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

        const closeModalButton = modalOverlay.querySelector('.close-modal-btn');
        const addFriendForm = modalOverlay.querySelector('#add-friend-form');
        const usernameInput = modalOverlay.querySelector('#add-friend-username-input');
        const statusMessage = modalOverlay.querySelector('#friend-request-status');

        // Elementlerin bulunup bulunmadığını daha sağlam bir şekilde kontrol et
        if (!closeModalButton || !addFriendForm || !usernameInput || !statusMessage) {
            console.error('Modal içindeki alt elementlerden biri veya birkaçı bulunamadı.', {
                closeModalButton,
                addFriendForm,
                usernameInput,
                statusMessage
            });
            return;
        }

        const openModal = () => {
            modalOverlay.classList.add('active');
            usernameInput.focus();
        };

        const closeModal = () => {
            modalOverlay.classList.remove('active');
            // Formu ve durum mesajını sıfırla
            addFriendForm.reset();
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        };

        addFriendButton.addEventListener('click', openModal);
        closeModalButton.addEventListener('click', closeModal);
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
                    await sendFriendRequest(fullUsername);
                    showStatus(`'${fullUsername}' kişisine arkadaşlık isteği gönderildi!`, 'success');

                    setTimeout(() => {
                        closeModal();
                    }, 2000);

                } catch (error) {
                    showStatus(error.message || 'İstek gönderilirken bir hata oluştu.', 'error');
                }
            } else {
                console.error('`sendFriendRequest` fonksiyonu bulunamadı. dashboard.js yüklendiğinden emin olun.');
                showStatus('Arkadaş ekleme sistemi şu an kullanılamıyor.', 'error');
            }
        });

        function showStatus(message, type) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`; // 'success' veya 'error'
        }
    }
}); 