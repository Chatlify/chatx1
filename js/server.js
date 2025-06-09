document.addEventListener('DOMContentLoaded', () => {
    console.log("Cosmic Sunucu JS başlatıldı.");

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
                menuItem.onclick = () => {
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

    // Sağ tık menüsünü gizle
    document.addEventListener('click', () => {
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

    // Üye listesini gösterme/gizleme (Responsive)
    if (membersToggle) {
        const membersPanel = document.querySelector('.members-panel');
        membersToggle.addEventListener('click', () => {
            if (membersPanel) {
                membersPanel.classList.toggle('visible'); // CSS'de .visible sınıfı eklenecek
            }
        });
    }

    // Chat input alanının yüksekliğini içeriğe göre ayarla
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = `${chatInput.scrollHeight}px`;
        });
    }

    console.log('Chatlify Server Panel script loaded.');
});