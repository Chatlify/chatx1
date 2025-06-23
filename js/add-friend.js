document.addEventListener('DOMContentLoaded', () => {
    console.log('Arkadaş ekleme modülü yükleniyor...');

    // Gerekli elementleri bul
    const modalContainer = document.getElementById('add-friend-modal-container');
    const addFriendButton = document.getElementById('add-friend-button');

    if (!modalContainer || !addFriendButton) {
        console.error('Arkadaş ekleme modülü için gerekli HTML elementleri bulunamadı.');
        return;
    }

    console.log('Arkadaş ekleme butonuna olay dinleyicisi ekleniyor...');

    // Modal HTML'ini yükle
    fetch('add-friend.html')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.text();
        })
        .then(html => {
            console.log('Arkadaş ekleme modalı HTML içeriği yüklendi.');
            modalContainer.innerHTML = html;

            // HTML yüklendikten sonra olay dinleyicilerini kur
            setupModalEventListeners();

            // Butona tıklandığında modalı açacak olay dinleyicisini ekle
            addFriendButton.addEventListener('click', () => {
                const modalOverlay = document.getElementById('add-friend-modal');
                if (modalOverlay) {
                    openModal(modalOverlay);
                } else {
                    console.error('Arkadaş ekleme modalı (#add-friend-modal) bulunamadı.');
                }
            });
        })
        .catch(error => {
            console.error('Arkadaş ekleme modal HTML yüklenirken hata:', error);
            // Hata durumunda basit bir modal oluştur
            createSimpleModal();
        });

    // Basit bir modal oluştur (yedek plan)
    function createSimpleModal() {
        modalContainer.innerHTML = `
            <div id="add-friend-modal" class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <div class="modal-icon"><i class="fas fa-user-plus"></i></div>
                        <h3>Arkadaş Ekle</h3>
                        <button class="close-modal-btn" title="Kapat"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-info">Arkadaş eklemek için Chatlify kullanıcı adını girin.</p>
                        <form id="add-friend-form" class="input-wrapper">
                            <div class="add-friend-input-container">
                                <input type="text" id="add-friend-username-input" placeholder="Kullanıcı adını yazın..." autocomplete="off" required>
                                <i class="fas fa-at"></i>
                            </div>
                            <button type="submit" class="send-request-btn">
                                <span>Arkadaşlık İsteği Gönder</span>
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </form>
                        <div id="friend-request-status" class="status-message"></div>
                    </div>
                </div>
            </div>
        `;
        setupModalEventListeners();

        // Butona tıklandığında modalı açacak olay dinleyicisini ekle
        addFriendButton.addEventListener('click', () => {
            const modalOverlay = document.getElementById('add-friend-modal');
            if (modalOverlay) {
                openModal(modalOverlay);
            } else {
                console.error('Arkadaş ekleme modalı (#add-friend-modal) bulunamadı.');
            }
        });
    }

    // Modalı açma fonksiyonu
    function openModal(modalOverlay) {
        document.body.style.overflow = 'hidden'; // Arka planın kaydırılmasını engelle
        modalOverlay.style.display = 'flex';

        // Kısa bir gecikme sonrası active sınıfını ekle (CSS geçişi için)
        setTimeout(() => {
            modalOverlay.classList.add('active');
            // Panel açıldığında input alanına odaklan ve herhangi bir metni seç
            const usernameInput = modalOverlay.querySelector('#add-friend-username-input');
            if (usernameInput) {
                usernameInput.focus();
                usernameInput.select();
            }
        }, 10);
    }

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

        // Klavye erişilebilirliği
        closeModalButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                closeModal();
            }
        });

        // Gösterme ve gizleme olayları
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

        // Input alanında # karakteri olmadığında otomatik olarak placeholder'ı göster
        usernameInput.addEventListener('input', () => {
            const value = usernameInput.value.trim();

            if (!value.includes('#') && value.length > 0) {
                usernameInput.classList.add('warning');
            } else {
                usernameInput.classList.remove('warning');
            }
        });

        addFriendForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const fullUsername = usernameInput.value.trim();

            if (!fullUsername || !fullUsername.includes('#')) {
                showStatus('Lütfen geçerli bir kullanıcı adı ve etiket girin (örn: kullanici#1234).', 'error');
                usernameInput.classList.add('error');

                // Input alanını kısa bir süre titret
                usernameInput.classList.add('shake');
                setTimeout(() => {
                    usernameInput.classList.remove('shake');
                }, 500);

                return;
            }

            usernameInput.classList.remove('error');

            if (typeof window.sendFriendRequest === 'function') {
                try {
                    // Gönder butonunu devre dışı bırak ve yükleniyor göster
                    const submitButton = addFriendForm.querySelector('.send-request-btn');
                    const originalText = submitButton.innerHTML;

                    submitButton.disabled = true;
                    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

                    await window.sendFriendRequest(fullUsername);

                    // Butonu eski haline getir
                    submitButton.innerHTML = originalText;
                    submitButton.disabled = false;

                    // Başarılı mesajı göster
                    showStatus(`'${fullUsername}' kişisine arkadaşlık isteği gönderildi!`, 'success');

                    // Başarılı olduğunda input alanını temizle
                    usernameInput.value = '';

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

                // Bir okuma asistanı için ARIA özniteliklerini ayarla
                statusMessage.setAttribute('role', 'status');
                statusMessage.setAttribute('aria-live', 'polite');
            }, 10);
        }
    }
}); 