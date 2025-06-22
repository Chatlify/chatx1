document.addEventListener('DOMContentLoaded', () => {
    const modalContainer = document.getElementById('add-friend-modal-container');
    const addFriendButton = document.getElementById('add-friend-button');

    if (!modalContainer || !addFriendButton) {
        console.error('Arkadaş ekleme modülü için gerekli HTML elementleri bulunamadı.');
        return;
    }

    // Gerekli CSS dosyasını sayfaya ekle
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/add-friend.css';
    document.head.appendChild(link);

    // Modal HTML'ini yükle
    fetch('add-friend.html')
        .then(response => response.text())
        .then(html => {
            modalContainer.innerHTML = html;
            // HTML yüklendikten sonra olay dinleyicilerini kur
            setupModalEventListeners();
        })
        .catch(error => console.error('Arkadaş ekleme modal HTML yüklenirken hata:', error));

    function setupModalEventListeners() {
        const modalOverlay = document.getElementById('add-friend-modal');
        const closeModalButton = document.querySelector('.close-modal-btn');
        const addFriendForm = document.getElementById('add-friend-form');
        const usernameInput = document.getElementById('add-friend-username-input');
        const statusMessage = document.getElementById('friend-request-status');

        if (!modalOverlay || !closeModalButton || !addFriendForm || !usernameInput || !statusMessage) {
            console.error('Modal içindeki elementler bulunamadı.');
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

            // `sendFriendRequest` global fonksiyonunu çağırıyoruz
            // Bu fonksiyonun js/dashboard.js içinde tanımlı olduğunu ve global erişime açık olduğunu varsayıyoruz.
            if (typeof sendFriendRequest === 'function') {
                try {
                    // Not: Orijinal sendFriendRequest fonksiyonu sadece username alıyor olabilir.
                    // Biz burada kullanıcı adını ve etiketi ayırmadan direkt gönderiyoruz.
                    // Gerekirse dashboard.js'teki fonksiyonu güncellemek gerekebilir.
                    // Şimdilik, fonksiyonun "username#tag" formatını işleyebildiğini varsayalım.
                    await sendFriendRequest(fullUsername);

                    showStatus(`'${fullUsername}' kişisine arkadaşlık isteği gönderildi!`, 'success');

                    // Başarılı gönderim sonrası formu temizle ve modalı kapat
                    setTimeout(() => {
                        closeModal();
                    }, 2000); // Kullanıcının mesajı okuması için 2 saniye bekle

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