console.log('Arkadaş ekleme modülü yükleniyor...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('Arkadaş ekleme modülü başlatılıyor...');

    // Gerekli elementleri bul
    const modalContainer = document.getElementById('add-friend-modal-container');
    const addFriendButton = document.getElementById('add-friend-button');

    if (!modalContainer || !addFriendButton) {
        console.error('Arkadaş ekleme modülü için gerekli HTML elementleri bulunamadı.');
        return;
    }

    console.log('Arkadaş ekleme butonuna olay dinleyicisi ekleniyor...');

    // Modal HTML'ini oluştur
    const addFriendModalHTML = `
        <div id="addFriendModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <div class="modal-icon"><i class="fas fa-user-plus"></i></div>
                    <h3>Arkadaş Ekle</h3>
                    <button class="close-modal-btn" title="Kapat"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <p class="modal-info">Arkadaş eklemek için Chatlify kullanıcı adını girin.</p>
                    <form id="addFriendForm" class="input-wrapper">
                        <div class="add-friend-input-container">
                            <input type="text" id="friendUsername" placeholder="Kullanıcı adını yazın..." autocomplete="off" required>
                            <i class="fas fa-user"></i>
                        </div>
                        <div id="addFriendStatus" class="status-message"></div>
                        <button type="submit" class="send-request-btn">
                            <span>Arkadaşlık İsteği Gönder</span>
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Modal HTML'ini body'ye ekle
    document.body.insertAdjacentHTML('beforeend', addFriendModalHTML);

    // HTML'de bulunan butonun ID'si "add-friend-button" ve class'ı "add-friend-btn"
    const addFriendBtn = document.getElementById('add-friend-button');
    console.log("Arkadaş ekle butonu aranıyor:", addFriendBtn);

    // Modal elementlerini seç
    const addFriendModal = document.getElementById('addFriendModal');
    const closeAddFriendBtn = addFriendModal.querySelector('.close-modal-btn');
    const addFriendForm = document.getElementById('addFriendForm');
    const addFriendStatus = document.getElementById('addFriendStatus');
    const friendUsernameInput = document.getElementById('friendUsername');

    if (!addFriendModal || !addFriendBtn || !closeAddFriendBtn || !addFriendForm || !addFriendStatus || !friendUsernameInput) {
        console.error('Arkadaş ekleme modülü için gerekli HTML elementleri bulunamadı.', {
            addFriendModal,
            addFriendBtn,
            closeAddFriendBtn,
            addFriendForm,
            addFriendStatus,
            friendUsernameInput
        });
        return;
    }

    console.log('Arkadaş ekleme butonuna tıklandığında modalı aç');

    // Modal açma fonksiyonu
    function openAddFriendModal() {
        console.log('Modal açılıyor...');
        addFriendModal.style.display = 'flex';

        // Kısa bir gecikme sonrası active sınıfını ekle (CSS geçişi için)
        setTimeout(() => {
            addFriendModal.classList.add('active');
            // Panel açıldığında input alanına odaklan
            if (friendUsernameInput) {
                friendUsernameInput.focus();
            }
        }, 10);

        document.body.style.overflow = 'hidden'; // Scroll'u engelle
    }

    // Modal kapatma fonksiyonu
    function closeAddFriendModal() {
        console.log('Modal kapatılıyor...');
        addFriendModal.classList.remove('active');

        // Animasyon süresi kadar bekleyip modalı gizle
        setTimeout(() => {
            addFriendModal.style.display = 'none';
            document.body.style.overflow = ''; // Scroll'u serbest bırak
            addFriendForm.reset(); // Formu sıfırla
            addFriendStatus.textContent = ''; // Durum mesajını temizle
            addFriendStatus.className = 'status-message'; // Sınıfı sıfırla
        }, 300);
    }

    // Arkadaş ekle butonuna tıklandığında modalı aç
    if (addFriendBtn) {
        console.log('Arkadaş ekle butonuna tıklama olayı ekleniyor...');
        addFriendBtn.addEventListener('click', function (e) {
            console.log('Arkadaş ekle butonuna tıklandı');
            e.preventDefault();
            openAddFriendModal();
        });
    } else {
        console.error('Arkadaş ekle butonu bulunamadı! Manuel buton ekleniyor...');

        // Buton bulunamadığında manuel bir buton ekleyelim
        console.log('Manuel arkadaş ekle butonu ekleniyor...');
        const manualButton = document.createElement('button');
        manualButton.id = 'manual-add-friend-btn';
        manualButton.className = 'add-friend-btn';
        manualButton.innerHTML = '<i class="fas fa-user-plus"></i><span>Arkadaş Ekle</span>';
        manualButton.style.position = 'fixed';
        manualButton.style.bottom = '20px';
        manualButton.style.right = '20px';
        manualButton.style.zIndex = '999';
        document.body.appendChild(manualButton);

        manualButton.addEventListener('click', openAddFriendModal);
    }

    // X butonuna tıklandığında modalı kapat
    closeAddFriendBtn.addEventListener('click', closeAddFriendModal);

    // Modal dışına tıklandığında modalı kapat
    window.addEventListener('click', (event) => {
        if (event.target === addFriendModal) {
            closeAddFriendModal();
        }
    });

    // ESC tuşuna basıldığında modalı kapat
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && addFriendModal.classList.contains('active')) {
            closeAddFriendModal();
        }
    });

    // Form gönderildiğinde arkadaşlık isteği gönder
    addFriendForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const friendUsername = document.getElementById('friendUsername').value.trim();

        if (!friendUsername) {
            showStatus('Lütfen bir kullanıcı adı girin.', 'error');
            friendUsernameInput.classList.add('error');

            // Input alanını kısa bir süre titret
            friendUsernameInput.classList.add('shake');
            setTimeout(() => {
                friendUsernameInput.classList.remove('shake');
            }, 500);

            return;
        }

        friendUsernameInput.classList.remove('error');

        // Butonun durumunu güncelle
        const submitButton = document.querySelector('.send-request-btn');
        const originalHTML = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

        try {
            // Global sendFriendRequest fonksiyonunu çağır
            await window.sendFriendRequest(friendUsername);

            showStatus(`${friendUsername} kullanıcısına arkadaşlık isteği gönderildi.`, 'success');

            // Başarılı olduğunda input alanını temizle
            friendUsernameInput.value = '';

            // Kısa bir süre sonra modalı kapat
            setTimeout(() => {
                closeAddFriendModal();
            }, 2000);
        } catch (error) {
            console.error('Arkadaşlık isteği gönderme hatası:', error);
            showStatus(error.message || 'Bir hata oluştu. Lütfen tekrar deneyin.', 'error');
        } finally {
            // Butonun durumunu geri al
            submitButton.innerHTML = originalHTML;
            submitButton.disabled = false;
        }
    });

    // Durum mesajı gösterme fonksiyonu
    function showStatus(message, type) {
        addFriendStatus.textContent = message;
        addFriendStatus.className = `status-message ${type}`;

        // Bir okuma asistanı için ARIA özniteliklerini ayarla
        addFriendStatus.setAttribute('role', 'status');
        addFriendStatus.setAttribute('aria-live', 'polite');
    }

    // CSS stillerini ekle
    const style = document.createElement('style');
    style.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.3s;
        }

        .modal-content {
            background-color: #2c2f33;
            margin: 10% auto;
            padding: 0;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            border-bottom: 1px solid #40444b;
        }

        .modal-header h2 {
            color: #ffffff;
            margin: 0;
            font-size: 1.5rem;
        }

        .close {
            color: #72767d;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.2s;
        }

        .close:hover {
            color: #ffffff;
        }

        .modal-body {
            padding: 20px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #b9bbbe;
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #40444b;
            background-color: #40444b;
            color: #ffffff;
            font-size: 16px;
            box-sizing: border-box;
        }

        .form-group input:focus {
            outline: none;
            border-color: #7289da;
        }

        button[type="submit"] {
            width: 100%;
            padding: 12px;
            background-color: #7289da;
            color: #ffffff;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        button[type="submit"]:hover {
            background-color: #677bc4;
        }

        button[type="submit"]:disabled {
            background-color: #677bc4;
            opacity: 0.7;
            cursor: not-allowed;
        }

        .status-message {
            margin: 15px 0;
            padding: 10px;
            border-radius: 5px;
            font-size: 14px;
            display: none;
        }

        .status-message:not(:empty) {
            display: block;
        }

        .status-message.error {
            background-color: rgba(240, 71, 71, 0.1);
            color: #f04747;
            border: 1px solid rgba(240, 71, 71, 0.3);
        }

        .status-message.success {
            background-color: rgba(67, 181, 129, 0.1);
            color: #43b581;
            border: 1px solid rgba(67, 181, 129, 0.3);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateY(-50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;

    document.head.appendChild(style);
}); 