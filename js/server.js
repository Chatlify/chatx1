document.addEventListener('DOMContentLoaded', () => {
    console.log("Cosmic Sunucu JS başlatıldı.");

    // Snowflake ID üreticiyi başlat
    // Not: Tarayıcıda makine ID'si veya diğer özel ayarlar olmadan temel bir örnek oluşturulur.
    const snowflake = new Snowflake({
        worker_id: 1, // Örnek bir worker ID
        epoch: 1609459200000, // Özel bir başlangıç zamanı (isteğe bağlı), örneğin 1 Ocak 2021
    });
    console.log("Snowflake ID üretici hazır.");

    // Gerekli tüm DOM elementlerini seç
    const channelItems = document.querySelectorAll('.channel-item, .voice-channel-header');
    const categoryHeaders = document.querySelectorAll('.category-header');
    const userPanel = document.querySelector('.user-panel');
    const messageGroups = document.querySelectorAll('.message-group');
    const members = document.querySelectorAll('.member-item');
    const contextMenu = document.getElementById('contextMenu');
    const channelsPanel = document.querySelector('.channels-panel');
    const membersToggle = document.querySelector('.members-toggle');
    const hamburgerMenu = document.querySelector('.hamburger-menu'); // Mobil için menü butonu
    const chatInput = document.querySelector('.chat-input');
    const messagesContainer = document.querySelector('.messages-container'); // Mesajların ekleneceği alan

    // Yeni eklenenler
    const serverMenuBtn = document.querySelector('.server-menu-btn');
    const serverMenuDropdown = document.querySelector('.server-menu-dropdown');
    const membersToggleBtn = document.querySelector('.members-toggle');
    const membersPanel = document.querySelector('.members-panel');
    const serverLayout = document.querySelector('.server-layout');
    const dateDisplay = document.querySelector('.date-display');
    const testDenemeDate = document.querySelector('.test-deneme-date');

    // Tarih gösterimi için fonksiyon
    function updateDateTime() {
        const now = new Date();
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        const dateStr = now.toLocaleDateString('tr-TR', options);

        if (dateDisplay) {
            dateDisplay.textContent = dateStr;
        }

        if (testDenemeDate) {
            testDenemeDate.textContent = dateStr;
        }
    }

    // Sayfa yüklendiğinde tarihi güncelle
    updateDateTime();

    // Her dakika tarihi güncelle
    setInterval(updateDateTime, 60000);

    // Aktif Kanal Değiştirme
    channelItems.forEach(item => {
        item.addEventListener('click', () => {
            // Önceki aktif kanaldan 'active' sınıfını kaldır
            document.querySelector('.channel-item.active, .voice-channel-header.active')?.classList.remove('active');
            // Tıklanan kanala 'active' sınıfını ekle
            item.classList.add('active');

            // Orta paneldeki kanal ismini ve ikonunu güncelle (isteğe bağlı)
            const channelName = item.querySelector('.channel-name').textContent.trim();
            const channelIcon = item.querySelector('.channel-icon').cloneNode(true);

            const chatHeaderName = document.querySelector('.current-channel-name');
            const chatHeaderIcon = document.querySelector('.chat-header .channel-info i');

            if (chatHeaderName) chatHeaderName.textContent = channelName;
            if (chatHeaderIcon) chatHeaderIcon.className = channelIcon.className;

            // Mobil görünümde menüyü kapat
            if (window.innerWidth <= 768) {
                channelsPanel.classList.remove('open');
            }
        });
    });

    // Kategori Açma/Kapatma
    categoryHeaders.forEach(header => {
        header.addEventListener('click', () => {
            header.classList.toggle('collapsed');
            const channels = header.nextElementSibling;
            if (channels && channels.classList.contains('category-channels')) {
                channels.style.display = header.classList.contains('collapsed') ? 'none' : 'block';
            }
        });
    });

    // Sunucu Menüsü (3 nokta) Açma/Kapatma
    if (serverMenuBtn && serverMenuDropdown) {
        serverMenuBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Olayın dışarıya yayılmasını engelle
            serverMenuDropdown.classList.toggle('active');
        });
    }

    // Üye Paneli (sağ taraf) Açma/Kapatma
    if (membersToggleBtn && membersPanel && serverLayout) {
        membersToggleBtn.addEventListener('click', () => {
            membersPanel.classList.toggle('closed');
            serverLayout.classList.toggle('members-closed');
        });
    }

    // Context Menu (Sağ Tık Menüsü)
    const showContextMenu = (event, items) => {
        event.preventDefault();
        contextMenu.innerHTML = ''; // Menüyü temizle
        items.forEach(item => {
            if (item.divider) {
                contextMenu.appendChild(document.createElement('div')).className = 'context-divider';
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = `context-item ${item.class || ''}`;
                menuItem.innerHTML = `<i class="${item.icon}"></i><span>${item.text}</span>`;
                menuItem.onclick = (e) => {
                    e.stopPropagation();
                    item.action();
                    contextMenu.classList.remove('active');
                };
                contextMenu.appendChild(menuItem);
            }
        });

        contextMenu.style.left = `${event.pageX}px`;
        contextMenu.style.top = `${event.pageY}px`;
        contextMenu.classList.add('active');
    };

    // Açık menüleri kapatma
    document.addEventListener('click', () => {
        if (serverMenuDropdown && serverMenuDropdown.classList.contains('active')) {
            serverMenuDropdown.classList.remove('active');
        }
        if (contextMenu.classList.contains('active')) {
            contextMenu.classList.remove('active');
        }
    });

    // Farklı elementler için context menu tanımlamaları
    userPanel.addEventListener('contextmenu', (e) => {
        showContextMenu(e, [
            { text: 'Durumu Değiştir', icon: 'fas fa-smile', action: () => console.log('Durum değiştirildi.') },
            { text: 'Profilim', icon: 'fas fa-user-edit', action: () => console.log('Profil düzenlendi.') },
            { divider: true },
            { text: 'Ayarlar', icon: 'fas fa-cog', action: () => console.log('Ayarlar açıldı.') }
        ]);
    });

    messageGroups.forEach(msg => {
        msg.addEventListener('contextmenu', (e) => {
            showContextMenu(e, [
                { text: 'Yanıtla', icon: 'fas fa-reply', action: () => console.log('Mesaj yanıtlandı.') },
                { text: 'Kopyala', icon: 'fas fa-copy', action: () => console.log('Mesaj kopyalandı.') },
                { text: 'Sabitle', icon: 'fas fa-thumbtack', action: () => console.log('Mesaj sabitlendi.') },
                { divider: true },
                { text: 'Sil', icon: 'fas fa-trash-alt', class: 'danger', action: () => console.log('Mesaj silindi.') }
            ]);
        });
    });

    members.forEach(member => {
        member.addEventListener('contextmenu', (e) => {
            showContextMenu(e, [
                { text: 'Profil', icon: 'fas fa-user', action: () => console.log('Profil görüntülendi.') },
                { text: 'Mesaj Gönder', icon: 'fas fa-paper-plane', action: () => console.log('Mesaj gönderildi.') },
                { divider: true },
                { text: 'Sustur', icon: 'fas fa-microphone-slash', class: 'danger', action: () => console.log('Kullanıcı susturuldu.') },
                { text: 'At', icon: 'fas fa-sign-out-alt', class: 'danger', action: () => console.log('Kullanıcı atıldı.') }
            ]);
        });
    });

    // Mobil/Tablet için Kanal Panelini Açma/Kapatma
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
            channelsPanel.classList.toggle('open');
        });
    }

    // Chat input alanının yüksekliğini içeriğe göre ayarla
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
        });

        // Enter tuşuyla mesaj gönderme ve ID üretme
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // Enter'ın varsayılan davranışını (yeni satır) engelle
                const messageText = chatInput.value.trim();
                if (messageText) {
                    const messageId = snowflake.generate();

                    // GÜVENLİ YÖNTEM: Elementleri manuel olarak oluştur
                    const messageElement = document.createElement('div');
                    messageElement.className = 'message';

                    const avatarImg = document.createElement('img');
                    avatarImg.src = "https://i.ibb.co/3k5g78k/siyah.png"; // Statik avatar yolu
                    avatarImg.alt = "Avatar";
                    avatarImg.className = "avatar";

                    const messageContentDiv = document.createElement('div');
                    messageContentDiv.className = 'message-content';

                    const messageHeaderDiv = document.createElement('div');

                    const usernameSpan = document.createElement('span');
                    usernameSpan.className = 'username';
                    usernameSpan.textContent = "Kullanıcı"; // Statik kullanıcı adı

                    const timestampSpan = document.createElement('span');
                    timestampSpan.className = 'timestamp';
                    timestampSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const messageTextP = document.createElement('p');
                    messageTextP.className = 'message-text';
                    messageTextP.dataset.id = messageId;
                    // !!! XSS GÜVENLİK DÜZELTMESİ BURADA !!!
                    // Kullanıcı girdisi .textContent ile atanarak zararsız hale getirilir.
                    messageTextP.textContent = messageText;

                    // Elementleri birbirine ekle
                    messageHeaderDiv.appendChild(usernameSpan);
                    messageHeaderDiv.appendChild(timestampSpan);
                    messageContentDiv.appendChild(messageHeaderDiv);
                    messageContentDiv.appendChild(messageTextP);
                    messageElement.appendChild(avatarImg);
                    messageElement.appendChild(messageContentDiv);

                    messagesContainer.appendChild(messageElement);
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;

                    console.log(`Mesaj Gönderildi: "${messageText}" | ID: ${messageId}`);

                    chatInput.value = '';
                }
            }
        });
    }

    console.log('Chatlify Server Panel script loaded and updated.');

    const createServerCard = document.getElementById('create-server-card');
    const joinServerCard = document.getElementById('join-server-card');
    const closeModalBtn = document.querySelector('.close-modal-btn');

    if (createServerCard) {
        createServerCard.addEventListener('click', () => {
            console.log('Sunucu oluşturma seçeneği tıklandı.');
            // Burada sunucu oluşturma formunu gösteren kod olacak
            alert('Sunucu oluşturma özelliği yakında eklenecektir!');
        });
    }

    if (joinServerCard) {
        joinServerCard.addEventListener('click', () => {
            console.log('Sunucuya katılma seçeneği tıklandı.');
            // Burada sunucuya katılma formunu gösteren kod olacak
            alert('Sunucuya katılma özelliği yakında eklenecektir!');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            // Pencereyi kapat veya bir önceki sayfaya dön
            // Basit bir çözüm olarak, eğer bu sayfa bir pop-up değilse,
            // kullanıcıyı dashboard'a geri yönlendirebiliriz.
            window.location.href = 'dashboard.html';
        });
    }
});