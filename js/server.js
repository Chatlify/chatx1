/**
 * Chatlify - Modern Sunucu Sayfası JavaScript
 * Dashboard ile uyumlu, özgün ve modern tasarım
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('Chatlify Sunucu JS yüklendi');

    // Snowflake ID oluşturucu - benzersiz ID'ler için
    const snowflake = new Snowflake({
        worker_id: 1,
        epoch: 1609459200000, // 1 Ocak 2021
    });

    // State Management - Sayfa durumunu takip etmek için
    const state = {
        currentChannel: null,
        currentUser: {
            id: 'user123',
            name: 'Kullanıcı',
            avatar: 'images/defaultavatar.png',
            status: 'online'
        },
        channels: {},
        messages: {},
        users: {}
    };

    // UI Elementleri
    const ui = {
        channelsSidebar: document.querySelector('.channels-sidebar'),
        membersSidebar: document.querySelector('.members-sidebar'),
        chatArea: document.querySelector('.chat-area'),
        messagesContainer: document.querySelector('.messages-container'),
        messageInput: document.querySelector('.message-input'),
        sendButton: document.querySelector('.send-btn'),
        categoryHeaders: document.querySelectorAll('.category-header'),
        channelItems: document.querySelectorAll('.channel-item'),
        voiceChannels: document.querySelectorAll('.voice-channel-header'),
        featuredChannels: document.querySelectorAll('.featured-channel'),
        serverMenuButton: document.querySelector('.server-actions-button'),
        serverMenuDropdown: document.querySelector('.server-menu-dropdown'),
        toggleMembersButton: document.querySelector('.toggle-members-btn'),
        serverLayout: document.querySelector('.server-layout'),
        backButton: document.querySelector('.back-button'),
        contextMenu: document.getElementById('contextMenu')
    };

    // Fonksiyonlar
    const functions = {
        // Kategori başlıklarına tıklandığında açılma/kapanma
        initCategoryToggles() {
            ui.categoryHeaders.forEach(header => {
                header.addEventListener('click', (e) => {
                    // Eğer "Yeni Kanal Ekle" butonuna tıklandıysa, kategorinin açılma/kapanma işlemi durdur
                    if (e.target.closest('.add-channel-btn')) {
                        return;
                    }

                    const toggleBtn = header.querySelector('.toggle-btn');
                    const channelsList = header.nextElementSibling;

                    header.classList.toggle('collapsed');

                    if (header.classList.contains('collapsed')) {
                        channelsList.style.height = '0';
                        toggleBtn.style.transform = 'rotate(-90deg)';
                    } else {
                        channelsList.style.height = channelsList.scrollHeight + 'px';
                        toggleBtn.style.transform = 'rotate(0deg)';
                    }
                });
            });
        },

        // Kanal değiştirme işlemleri
        initChannelSelection() {
            // Normal metin kanalları
            ui.channelItems.forEach(channel => {
                channel.addEventListener('click', () => {
                    // Aktif kanalı kaldır
                    document.querySelector('.channel-item.active')?.classList.remove('active');

                    // Yeni kanalı aktif et
                    channel.classList.add('active');

                    // Kanal bilgilerini güncelle
                    const channelName = channel.querySelector('.channel-name').textContent;
                    const channelIcon = channel.querySelector('.channel-icon i').className;
                    const channelDescription = channel.querySelector('.channel-description')?.textContent || 'Kanal açıklaması';

                    // UI'ı güncelle
                    functions.updateChannelHeader(channelName, channelIcon, channelDescription);

                    // Mobil görünümde kanal panelini kapat
                    if (window.innerWidth <= 768) {
                        ui.channelsSidebar.classList.remove('active');
                    }

                    // Gerekirse mesajları yükle
                    functions.loadChannelMessages(channelName);
                });
            });

            // Öne çıkan kanallar
            ui.featuredChannels.forEach(channel => {
                channel.addEventListener('click', () => {
                    document.querySelector('.featured-channel.active')?.classList.remove('active');
                    channel.classList.add('active');

                    const channelName = channel.querySelector('span').textContent;
                    const channelIcon = channel.querySelector('i').className;

                    functions.updateChannelHeader(channelName, channelIcon, 'Öne çıkan kanal');
                    functions.loadChannelMessages(channelName);
                });
            });

            // Ses kanalları
            ui.voiceChannels.forEach(channel => {
                channel.addEventListener('click', () => {
                    // Gerçek bir uygulamada burada ses bağlantısı açılır
                    console.log('Ses kanalına bağlanılıyor:', channel.querySelector('.channel-name').textContent);
                    alert('Ses kanalına bağlanma özelliği demo sürümünde aktif değildir.');
                });
            });
        },

        // Kanal başlığını güncelleme
        updateChannelHeader(name, iconClass, description) {
            const channelTitle = document.querySelector('.channel-title');
            const channelIcon = document.querySelector('.current-channel .channel-icon i');
            const channelTopic = document.querySelector('.channel-topic');

            channelTitle.textContent = name;
            channelIcon.className = iconClass;
            channelTopic.textContent = description;

            // Güncel kanalı state'e kaydet
            state.currentChannel = name;
        },

        // Kanaldaki mesajları yükleme simülasyonu
        loadChannelMessages(channelName) {
            // Mevcut mesajları temizle
            ui.messagesContainer.innerHTML = '';

            // Demo mesajlarını göster (gerçek uygulamada API'den gelir)
            const isDemoChannel = ['genel-sohbet', 'duyurular', 'popüler-konular'].includes(channelName);

            if (isDemoChannel) {
                // Hoş geldiniz banner'ı
                const welcomeBanner = document.createElement('div');
                welcomeBanner.className = 'welcome-banner';
                welcomeBanner.innerHTML = `
                    <div class="welcome-icon">
                        <i class="fas fa-hashtag"></i>
                    </div>
                    <h2 class="welcome-title">${channelName} kanalına hoş geldiniz!</h2>
                    <p class="welcome-text">Bu kanalın başlangıcı. Sunucu hakkında yardıma ihtiyacınız olursa @moderatör etiketini kullanabilirsiniz.</p>
                `;
                ui.messagesContainer.appendChild(welcomeBanner);

                // Demo mesajlar
                for (let i = 0; i < 3; i++) {
                    const demoMessage = functions.createDemoMessage(i);
                    ui.messagesContainer.appendChild(demoMessage);
                }
            } else {
                // Boş kanal mesajı
                const emptyChannel = document.createElement('div');
                emptyChannel.className = 'welcome-banner';
                emptyChannel.innerHTML = `
                    <div class="welcome-icon">
                        <i class="fas fa-hashtag"></i>
                    </div>
                    <h2 class="welcome-title">${channelName} kanalına hoş geldiniz!</h2>
                    <p class="welcome-text">Bu kanalda henüz mesaj bulunmuyor. İlk mesajı gönderen siz olun!</p>
                `;
                ui.messagesContainer.appendChild(emptyChannel);
            }

            // Mesaj konteynerini en alta kaydır
            ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;
        },

        // Demo mesaj oluşturma
        createDemoMessage(index) {
            const demoUsers = [
                { name: 'Mehmet', role: 'moderator', avatar: 'images/defaultavatar.png' },
                { name: 'Ayşe', role: 'premium', avatar: 'images/defaultavatar.png' },
                { name: 'Ahmet', role: '', avatar: 'images/defaultavatar.png' }
            ];

            const demoTexts = [
                'Merhaba arkadaşlar! Bugün sunucumuza yeni özellikler eklendi. Özellikle yeni tasarımımız nasıl görünüyor? 🎨',
                'Harika görünüyor! Özellikle yeni sunucu sayfası çok modern olmuş. Emeği geçen herkese teşekkürler.',
                'Kesinlikle katılıyorum, eski tasarımdan çok daha iyi olmuş. Kullanımı da daha kolay gibi. 👍'
            ];

            const user = demoUsers[index % demoUsers.length];
            const text = demoTexts[index % demoTexts.length];

            // Mesaj grubu oluştur
            const messageGroup = document.createElement('div');
            messageGroup.className = 'message-group';
            messageGroup.dataset.userId = `user${index}`;

            // Eklenme zamanını belirle
            const timeAgo = index * 2 + 1; // dakika
            const messageTime = new Date(Date.now() - timeAgo * 60 * 1000);
            const formattedTime = `Bugün ${messageTime.getHours().toString().padStart(2, '0')}:${messageTime.getMinutes().toString().padStart(2, '0')}`;

            // HTML içeriğini oluştur
            messageGroup.innerHTML = `
                <div class="message-avatar">
                    <img src="${user.avatar}" alt="${user.name}">
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-author">
                            <span class="author-name">${user.name}</span>
                            ${user.role ? `<span class="author-badge ${user.role}">${user.role === 'moderator' ? 'Moderatör' : 'Premium'}</span>` : ''}
                        </div>
                        <span class="message-time">${formattedTime}</span>
                    </div>
                    <div class="message-body">
                        <p>${text}</p>
                        ${index === 1 ? `
                        <div class="attachment-preview">
                            <img src="https://via.placeholder.com/400x200" alt="Ekran görüntüsü">
                            <div class="attachment-info">
                                <span class="attachment-name">sunucu-goruntusu.png</span>
                                <span class="attachment-size">1.2 MB</span>
                            </div>
                        </div>` : ''}
                    </div>
                    <div class="message-reactions">
                        <div class="reaction-badge">
                            <span class="reaction-emoji">👍</span>
                            <span class="reaction-count">${index + 2}</span>
                        </div>
                        <div class="reaction-badge">
                            <span class="reaction-emoji">❤️</span>
                            <span class="reaction-count">${index + 1}</span>
                        </div>
                        <button class="add-reaction-btn">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            `;

            // Sağ tık menüsü için event listener ekle
            messageGroup.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                functions.showContextMenu(e, [
                    { text: 'Yanıtla', icon: 'fas fa-reply', action: () => console.log('Mesaja yanıt verildi') },
                    {
                        text: 'Kopyala', icon: 'fas fa-copy', action: () => {
                            navigator.clipboard.writeText(text).then(() => {
                                console.log('Mesaj kopyalandı');
                            });
                        }
                    },
                    { text: 'Tepki Ekle', icon: 'fas fa-smile', action: () => console.log('Tepki eklendi') },
                    { divider: true },
                    { text: 'Sil', icon: 'fas fa-trash-alt', class: 'danger', action: () => console.log('Mesaj silindi') }
                ]);
            });

            return messageGroup;
        },

        // Mesaj gönderme
        initMessageSending() {
            // Mesaj input alanı otomatik büyüme
            ui.messageInput.addEventListener('input', () => {
                ui.messageInput.style.height = 'auto';
                ui.messageInput.style.height = `${Math.min(ui.messageInput.scrollHeight, 200)}px`;
            });

            // Enter tuşu ile gönderme
            ui.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    functions.sendMessage();
                }
            });

            // Gönder butonu ile gönderme
            ui.sendButton.addEventListener('click', functions.sendMessage);
        },

        // Mesaj gönderme işlemi
        sendMessage() {
            const messageText = ui.messageInput.value.trim();
            if (!messageText) return;

            // Mesajı oluştur
            const messageId = snowflake.generate();
            const currentTime = new Date();
            const formattedTime = `Bugün ${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

            const messageGroup = document.createElement('div');
            messageGroup.className = 'message-group own-message';
            messageGroup.dataset.messageId = messageId;

            messageGroup.innerHTML = `
                <div class="message-avatar">
                    <img src="${state.currentUser.avatar}" alt="${state.currentUser.name}">
                </div>
                <div class="message-content">
                    <div class="message-header">
                        <div class="message-author">
                            <span class="author-name">${state.currentUser.name}</span>
                        </div>
                        <span class="message-time">${formattedTime}</span>
                    </div>
                    <div class="message-body">
                        <p>${messageText.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;

            // Mesajı ekle ve en alta kaydır
            ui.messagesContainer.appendChild(messageGroup);
            ui.messagesContainer.scrollTop = ui.messagesContainer.scrollHeight;

            // Input alanını temizle
            ui.messageInput.value = '';
            ui.messageInput.style.height = 'auto';

            // Gerçek uygulamada burada API'ye mesaj gönderilir
            console.log(`Mesaj gönderildi. ID: ${messageId}, Kanal: ${state.currentChannel}, İçerik: ${messageText}`);
        },

        // Context menu (sağ tık menüsü) gösterme
        showContextMenu(event, items) {
            // Önceki menüyü temizle
            ui.contextMenu.innerHTML = '';

            // Yeni menü öğelerini ekle
            items.forEach(item => {
                if (item.divider) {
                    const divider = document.createElement('div');
                    divider.className = 'menu-divider';
                    ui.contextMenu.appendChild(divider);
                } else {
                    const menuItem = document.createElement('div');
                    menuItem.className = `menu-item ${item.class || ''}`;
                    menuItem.innerHTML = `
                        <i class="${item.icon}"></i>
                        <span>${item.text}</span>
                    `;
                    menuItem.addEventListener('click', () => {
                        item.action();
                        functions.hideContextMenu();
                    });
                    ui.contextMenu.appendChild(menuItem);
                }
            });

            // Menüyü konumlandır ve göster
            ui.contextMenu.style.top = `${event.pageY}px`;
            ui.contextMenu.style.left = `${event.pageX}px`;
            ui.contextMenu.classList.add('active');

            // Viewport dışına taşmayı engelle
            const rect = ui.contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                ui.contextMenu.style.left = `${window.innerWidth - rect.width - 5}px`;
            }
            if (rect.bottom > window.innerHeight) {
                ui.contextMenu.style.top = `${window.innerHeight - rect.height - 5}px`;
            }
        },

        // Context menu'yü gizleme
        hideContextMenu() {
            ui.contextMenu.classList.remove('active');
        },

        // Sunucu menüsü açma/kapama
        initServerMenu() {
            ui.serverMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                ui.serverMenuDropdown.classList.toggle('active');
            });

            // Menü öğelerine tıklandığında işlevler
            const menuItems = document.querySelectorAll('.server-menu-dropdown .menu-item');
            menuItems.forEach(item => {
                item.addEventListener('click', () => {
                    const action = item.textContent.trim();
                    console.log(`Menü eylemi: ${action}`);

                    if (action.includes('Ayrıl')) {
                        if (confirm('Sunucudan ayrılmak istediğinize emin misiniz?')) {
                            window.location.href = 'dashboard.html';
                        }
                    }

                    ui.serverMenuDropdown.classList.remove('active');
                });
            });
        },

        // Üye panelini açma/kapama
        initMembersPanel() {
            ui.toggleMembersButton.addEventListener('click', () => {
                ui.membersSidebar.classList.toggle('active');
                ui.serverLayout.classList.toggle('members-closed');
            });
        },

        // Geri butonu işlevi
        initBackButton() {
            ui.backButton.addEventListener('click', () => {
                window.location.href = 'dashboard.html';
            });
        },

        // Mobil cihazlar için hamburger menü
        initMobileMenu() {
            // Mobil görünümde hamburger menü ekle
            if (window.innerWidth <= 768) {
                const hamburgerButton = document.createElement('button');
                hamburgerButton.className = 'hamburger-menu';
                hamburgerButton.innerHTML = '<i class="fas fa-bars"></i>';
                document.querySelector('.chat-header').prepend(hamburgerButton);

                hamburgerButton.addEventListener('click', () => {
                    ui.channelsSidebar.classList.toggle('active');
                });
            }
        },

        // Dışa tıklandığında açık menüleri kapat
        initClickOutsideHandler() {
            document.addEventListener('click', (e) => {
                // Context menu dışına tıklandığında kapat
                if (!e.target.closest('.context-menu') && ui.contextMenu.classList.contains('active')) {
                    functions.hideContextMenu();
                }

                // Server menu dışına tıklandığında kapat
                if (!e.target.closest('.server-actions-button') && !e.target.closest('.server-menu-dropdown') && ui.serverMenuDropdown.classList.contains('active')) {
                    ui.serverMenuDropdown.classList.remove('active');
                }

                // Mobil görünümde panel dışına tıklandığında kapat
                if (window.innerWidth <= 768) {
                    if (!e.target.closest('.channels-sidebar') && !e.target.closest('.hamburger-menu') && ui.channelsSidebar.classList.contains('active')) {
                        ui.channelsSidebar.classList.remove('active');
                    }

                    if (!e.target.closest('.members-sidebar') && !e.target.closest('.toggle-members-btn') && ui.membersSidebar.classList.contains('active')) {
                        ui.membersSidebar.classList.remove('active');
                    }
                }
            });
        }
    };

    // Sayfa yüklendiğinde tüm işlevleri başlat
    functions.initCategoryToggles();
    functions.initChannelSelection();
    functions.initMessageSending();
    functions.initServerMenu();
    functions.initMembersPanel();
    functions.initBackButton();
    functions.initMobileMenu();
    functions.initClickOutsideHandler();

    // İlk kanalı aktif et (varsayılan görünüm)
    const defaultChannel = document.querySelector('.channel-item.active') || document.querySelector('.channel-item');
    if (defaultChannel) {
        defaultChannel.click();
    }
});