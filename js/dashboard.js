import { supabase } from './auth_config.js'; // Supabase istemcisini import et

// Global değişkenler tanımları
let currentUserId = null;
let onlineFriends = new Set();
let presenceChannel = null;
let currentConversationId = null; // Aktif sohbet için ID
let messageSubscription = null; // Realtime mesaj aboneliği
let sampleColumnFormat = 'camelCase'; // Varsayılan olarak camelCase formatını kullan
const defaultAvatar = 'images/DefaultAvatar.png';
let messageNotificationSound = null; // Ses nesnesi için global değişken
let unreadCounts = {}; // Okunmamış mesaj sayaçları { userId: count }
const TENOR_API_KEY = 'AIzaSyCjseHq-Gn4cii_fVDtSX3whyY94orNWPM'; // Tenor API anahtarı

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard JS başlatılıyor...');

    try {
        // Element tanımlamaları
        const userPanelUsernameElement = document.querySelector('.dm-footer .dm-user-name');
        const userPanelAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');

        const tabs = document.querySelectorAll('.dashboard-header .tab');
        const onlineSection = document.querySelector('.online-section-title');
        const onlineList = document.querySelector('.online-friends');
        const offlineSection = document.querySelector('.offline-section-title');
        const offlineList = document.querySelector('.offline-friends');
        const pendingSection = document.querySelector('.pending-section-title');
        const pendingList = document.querySelector('.pending-requests');
        const pendingCountBadge = document.querySelector('.pending-count');
        const dmList = document.querySelector('#friends-group .dm-items');
        const chatPanel = document.querySelector('.chat-panel');
        const chatHeaderUser = chatPanel?.querySelector('.chat-header-user');
        const chatMessagesContainer = chatPanel?.querySelector('.chat-messages');
        const friendsPanelContainer = document.querySelector('.friends-panel-container');
        const sponsorSidebar = document.querySelector('.sponsor-sidebar');
        const settingsButtonContainer = document.querySelector('.server-sidebar .server-item:has(.server-settings-icon)');
        const chatCloseBtn = chatPanel?.querySelector('.chat-close-btn');
        const chatEmojiBtn = chatPanel?.querySelector('.emoji-btn');

        // Ekranda görülen "button.chat-attachment-btn" ID'li butonu seç
        const chatGifBtn = document.querySelector('button.chat-attachment-btn');

        const chatTextarea = chatPanel?.querySelector('.chat-textbox textarea');
        const emojiPicker = document.querySelector('emoji-picker');

        // Kritik elementlerin varlığını kontrol et
        validateRequiredElements({
            userPanelUsernameElement,
            userPanelAvatarElement,
            chatPanel,
            chatMessagesContainer,
            chatTextarea
        });

        // Kullanıcı oturumunu başlat
        const userSessionActive = await initializeUserSession({
            userPanelUsernameElement,
            userPanelAvatarElement
        });

        if (!userSessionActive) return; // Oturum yoksa devam etme

        // Tab kontrolünü kur
        setupTabControls(tabs);

        // Mesaj göndermesi için gerekli dinleyicileri ekle
        setupMessageSending(chatTextarea);

        // Emoji picker dinleyicisini kur
        if (chatEmojiBtn && chatTextarea && emojiPicker) {
            setupEmojiPicker(chatEmojiBtn, chatTextarea, emojiPicker);
        }

        // GIF picker dinleyicisini kur
        if (chatGifBtn) {
            console.log('GIF butonu bulundu, hazırlanıyor:', chatGifBtn);
            setupGifPicker(chatGifBtn, chatTextarea);
        } else {
            console.warn('chat-attachment-btn sınıflı buton bulunamadı');

            // Sayfa tamamen yüklendiğinde butonu tekrar ara (geç yüklenmesi ihtimaline karşı)
            setTimeout(() => {
                const attachmentButton = document.querySelector('button.chat-attachment-btn');
                if (attachmentButton) {
                    console.log('GIF butonu (gecikmeli) bulundu:', attachmentButton);
                    setupGifPicker(attachmentButton, chatTextarea);
                } else {
                    console.error('GIF butonu bulunamadı, tüm butonları listeliyorum:');
                    document.querySelectorAll('button').forEach((btn, i) => {
                        console.log(`Buton ${i}:`, btn.outerHTML);
                    });
                }
            }, 2000);
        }

        // Varsayılan sekmeyi göster
        const defaultTabContents = {
            'Tüm Arkadaşlar': '.friends-panel-container',
            'Çevrimiçi': '.online-section',
            'Bekleyen': '.pending-requests-section'
        };
        showSection('Tüm Arkadaşlar', defaultTabContents);

        // Arkadaş listesini yükle
        await loadAllFriends({
            onlineList,
            offlineList,
            dmList,
            onlineSection,
            offlineSection
        });

        // Bekleyen istekleri yükle
        await loadPendingRequests(pendingList, pendingCountBadge);

        // Sunucu panelini kur
        setupServerPanel();

        // Kontekst menüleri için dinleyicileri ekle
        addContextMenuListeners();

        // Presence takip sistemini başlat
        initializePresence();

        // Arkadaş Ekle modalını kur
        setupAddFriendModal();

        // Bekleyen arkadaşlık istekleri için realtime aboneliğini kur
        setupPendingFriendRequestSubscription();

        console.log('Dashboard JS başlatma tamamlandı.');
    } catch (error) {
        console.error('Dashboard başlatma hatası:', error);
        alert('Sayfa başlatılırken bir hata oluştu. Lütfen sayfayı yenileyiniz.');
    }

    // Zorunlu elementlerin varlığını kontrol eden yardımcı fonksiyon
    function validateRequiredElements(elements) {
        const criticalElements = [
            { element: elements.userPanelUsernameElement, name: '.dm-footer .dm-user-name' },
            { element: elements.userPanelAvatarElement, name: '.dm-footer .dm-user-avatar img' },
            { element: elements.chatPanel, name: '.chat-panel' },
            { element: elements.chatMessagesContainer, name: '.chat-messages' },
            { element: elements.chatTextarea, name: '.chat-textbox textarea' }
        ];

        const missingElements = criticalElements.filter(item => !item.element);

        if (missingElements.length > 0) {
            console.error('Kritik elementler bulunamadı:',
                missingElements.map(item => item.name).join(', '));
        }
    }

    // Tab yönetimi için dinleyicileri oluşturan yardımcı fonksiyon
    function setupTabControls(tabs) {
        if (!tabs || !tabs.length) return;

        const tabContents = {
            'Tüm Arkadaşlar': '.friends-panel-container',
            'Çevrimiçi': '.online-section',
            'Bekleyen': '.pending-requests-section'
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Tüm sekmeleri sıfırla
                tabs.forEach(t => t.classList.remove('active'));

                // Tıklanan sekmeyi aktif yap
                tab.classList.add('active');

                // İçeriği göster/gizle
                const tabName = tab.textContent.trim();
                showSection(tabName, tabContents);

                // Eğer "Bekleyen" sekmesine tıklandıysa bekleyen istekleri yükle
                if (tabName === 'Bekleyen') {
                    loadPendingFriendRequests();
                }
            });
        });
    }

    // Bekleyen arkadaşlık isteklerini yükle ve görüntüle
    async function loadPendingFriendRequests() {
        // Bekleyen istekler konteynerini seç
        const pendingContainer = document.querySelector('.pending-requests-container');
        if (!pendingContainer) {
            console.error('Bekleyen istekler konteyneri bulunamadı');
            return;
        }

        try {
            // Yükleniyor durumunu göster
            pendingContainer.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Bekleyen istekler yükleniyor...</div>';

            // Bekleyen istekleri veritabanından çek
            const { data: pendingRequests, error } = await supabase
                .from('friendships')
                .select(`
                    id,
                    user_id_1,
                    user_id_2,
                    users!friendships_user_id_1_fkey (id, username, avatar)
                `)
                .eq('status', 'pending')
                .eq('user_id_2', currentUserId);

            if (error) {
                throw error;
            }

            // Bekleyen istek yoksa boş durum göster
            if (!pendingRequests || pendingRequests.length === 0) {
                pendingContainer.innerHTML = '<div class="empty-placeholder">Bekleyen arkadaşlık isteği bulunmamaktadır.</div>';

                // Bekleyen istek sayısını güncelle
                document.querySelectorAll('.pending-count').forEach(badge => {
                    badge.textContent = '0';
                });
                return;
            }

            // Bekleyen istekleri görüntüle
            pendingContainer.innerHTML = '';
            pendingRequests.forEach(request => {
                const sender = request.users;
                if (!sender) {
                    console.warn('İstek gönderen kullanıcı bilgileri eksik:', request);
                    return;
                }

                // Güvenli değerler
                const username = sender.username || 'Bilinmeyen Kullanıcı';
                const avatar = sender.avatar || defaultAvatar;
                const userId = sender.id;
                const requestId = request.id;

                // İstek satırını oluştur
                const requestRow = document.createElement('div');
                requestRow.className = 'friend-row pending';
                requestRow.dataset.requestId = requestId;
                requestRow.dataset.userId = userId;

                requestRow.innerHTML = `
                    <div class="friend-avatar">
                        <img src="${avatar}" alt="${username}" onerror="this.src='${defaultAvatar}'">
                        <span class="status-dot pending"></span>
                    </div>
                    <div class="friend-info">
                        <div class="friend-name">${username}</div>
                        <div class="friend-status">Arkadaşlık isteği gönderdi</div>
                    </div>
                    <div class="friend-actions pending-actions">
                        <button class="accept-request-btn" title="Kabul Et" data-request-id="${requestId}" data-user-id="${userId}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="decline-request-btn" title="Reddet" data-request-id="${requestId}" data-user-id="${userId}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;

                // İstek satırını konteynere ekle
                pendingContainer.appendChild(requestRow);

                // Kabul et butonuna tıklama olayı ekle
                const acceptBtn = requestRow.querySelector('.accept-request-btn');
                acceptBtn.addEventListener('click', () => acceptFriendRequest(requestId, userId, requestRow));

                // Reddet butonuna tıklama olayı ekle
                const declineBtn = requestRow.querySelector('.decline-request-btn');
                declineBtn.addEventListener('click', () => declineFriendRequest(requestId, requestRow));
            });

            // Bekleyen istek sayısını güncelle
            document.querySelectorAll('.pending-count').forEach(badge => {
                badge.textContent = pendingRequests.length;
            });
        } catch (error) {
            console.error('Bekleyen istekler yüklenirken hata:', error);
            pendingContainer.innerHTML = `<div class="error-placeholder">Bekleyen istekler yüklenirken bir hata oluştu: ${error.message}</div>`;
        }
    }

    // Arkadaşlık isteğini kabul et
    async function acceptFriendRequest(requestId, userId, requestRow) {
        try {
            // Önce butonları devre dışı bırak
            const buttons = requestRow.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);

            // İşleniyor görünümünü göster
            requestRow.classList.add('processing');

            // İsteği güncelle
            const { error } = await supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', requestId);

            if (error) throw error;

            // Başarılı olursa arayüzü güncelle
            requestRow.innerHTML = `
                <div class="friend-avatar">
                    <img src="${requestRow.querySelector('img').src}" alt="${requestRow.dataset.username || 'Kullanıcı'}">
                    <span class="status-dot online"></span>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${requestRow.querySelector('.friend-name').textContent}</div>
                    <div class="request-processed">
                        <i class="fas fa-check-circle"></i>
                        <span>Arkadaşlık isteği kabul edildi</span>
                    </div>
                </div>
            `;

            // Animasyonla kaldır
            setTimeout(() => {
                requestRow.classList.add('fade-out');
                setTimeout(() => {
                    requestRow.remove();

                    // Bekleyen istek sayısını güncelle
                    updatePendingRequestsCount();

                    // Eğer başka istek kalmadıysa boş durum mesajını göster
                    const pendingContainer = document.querySelector('.pending-requests-container');
                    if (pendingContainer && pendingContainer.children.length === 0) {
                        pendingContainer.innerHTML = '<div class="empty-placeholder">Bekleyen arkadaşlık isteği bulunmamaktadır.</div>';
                    }

                    // Arkadaş listesini yeniden yükle
                    loadAllFriends({
                        onlineList: document.querySelector('.online-friends'),
                        offlineList: document.querySelector('.offline-friends'),
                        dmList: document.querySelector('#friends-group .dm-items'),
                        onlineSection: document.querySelector('.online-section-title'),
                        offlineSection: document.querySelector('.offline-section-title')
                    });
                }, 1000);
            }, 2000);

        } catch (error) {
            console.error('Arkadaşlık isteği kabul edilirken hata:', error);

            // Hata durumunda işleme görünümünü kaldır ve butonları tekrar aktif et
            requestRow.classList.remove('processing');
            const buttons = requestRow.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = false);

            // Hata mesajını göster
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = `Hata: ${error.message}`;
            requestRow.appendChild(errorMessage);

            // Hata mesajını birkaç saniye sonra kaldır
            setTimeout(() => {
                errorMessage.remove();
            }, 3000);
        }
    }

    // Arkadaşlık isteğini reddet
    async function declineFriendRequest(requestId, requestRow) {
        try {
            // Önce butonları devre dışı bırak
            const buttons = requestRow.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = true);

            // İşleniyor görünümünü göster
            requestRow.classList.add('processing');

            // İsteği sil
            const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', requestId);

            if (error) throw error;

            // Başarılı olursa arayüzü güncelle
            requestRow.innerHTML = `
                <div class="friend-avatar">
                    <img src="${requestRow.querySelector('img').src}" alt="${requestRow.dataset.username || 'Kullanıcı'}">
                    <span class="status-dot offline"></span>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${requestRow.querySelector('.friend-name').textContent}</div>
                    <div class="request-processed">
                        <i class="fas fa-times-circle"></i>
                        <span>Arkadaşlık isteği reddedildi</span>
                    </div>
                </div>
            `;

            // Animasyonla kaldır
            setTimeout(() => {
                requestRow.classList.add('fade-out');
                setTimeout(() => {
                    requestRow.remove();

                    // Bekleyen istek sayısını güncelle
                    updatePendingRequestsCount();

                    // Eğer başka istek kalmadıysa boş durum mesajını göster
                    const pendingContainer = document.querySelector('.pending-requests-container');
                    if (pendingContainer && pendingContainer.children.length === 0) {
                        pendingContainer.innerHTML = '<div class="empty-placeholder">Bekleyen arkadaşlık isteği bulunmamaktadır.</div>';
                    }
                }, 1000);
            }, 2000);

        } catch (error) {
            console.error('Arkadaşlık isteği reddedilirken hata:', error);

            // Hata durumunda işleme görünümünü kaldır ve butonları tekrar aktif et
            requestRow.classList.remove('processing');
            const buttons = requestRow.querySelectorAll('button');
            buttons.forEach(btn => btn.disabled = false);

            // Hata mesajını göster
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = `Hata: ${error.message}`;
            requestRow.appendChild(errorMessage);

            // Hata mesajını birkaç saniye sonra kaldır
            setTimeout(() => {
                errorMessage.remove();
            }, 3000);
        }
    }

    // Bölümleri göster/gizle
    function showSection(sectionName, sections) {
        console.log(`Bölüm gösteriliyor: ${sectionName}`);

        // Sections parametresi verilmişse, o sections kullanarak bölümleri göster/gizle
        if (sections) {
            // Önce tüm bölümleri gizle
            Object.values(sections).forEach(selector => {
                const section = document.querySelector(selector);
                if (section) {
                    section.style.display = 'none';
                }
            });

            // Seçilen bölümü göster
            const sectionSelector = sections[sectionName];
            if (sectionSelector) {
                const section = document.querySelector(sectionSelector);
                if (section) {
                    section.style.display = 'block';
                }
            }

            // Eğer bekleyen istekler bölümüyse ve daha önce oluşturulmadıysa oluştur
            if (sectionName === 'Bekleyen' && !document.querySelector('.pending-requests-section')) {
                createPendingSection();
            }
        } else {
            // Eski davranış - sections parametresi yoksa
            const friendsPanel = document.querySelector('.friends-panel-container');
            const chatPanel = document.querySelector('.chat-panel');

            if (!friendsPanel || !chatPanel) return;

            // Önce sohbeti kapat (açıksa)
            closeChatPanel(); // Bu fonksiyon sohbeti kapatıp arkadaş panelini gösterir

            // Arkadaş panelini görünür yap
            friendsPanel.classList.remove('hidden');
        }

        // Aktif tab'ı ayarla (görsel olarak)
        document.querySelectorAll('.dashboard-header .tab').forEach(tab => {
            if (tab.textContent.trim() === sectionName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    // Bekleyen istekler bölümünü oluştur
    function createPendingSection() {
        const mainContainer = document.querySelector('.main-container');
        if (!mainContainer) return;

        // Eğer bölüm zaten varsa, tekrar oluşturma
        if (document.querySelector('.pending-requests-section')) return;

        // Bölümü oluştur
        const pendingSection = document.createElement('div');
        pendingSection.className = 'pending-requests-section';
        pendingSection.style.display = 'none'; // Başlangıçta gizli

        pendingSection.innerHTML = `
            <div class="friends-section-title pending-section-title">
                <i class="fas fa-clock"></i>
                <span>Bekleyen İstekler</span>
                <div class="pending-count">0</div>
            </div>
            <div class="pending-requests-container">
                <div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Bekleyen istekler yükleniyor...</div>
            </div>
        `;

        mainContainer.appendChild(pendingSection);
    }

    // Bekleyen arkadaşlık istekleri için realtime aboneliği
    function setupPendingFriendRequestSubscription() {
        if (!currentUserId) {
            console.warn('setupPendingFriendRequestSubscription: currentUserId bulunamadı');
            return;
        }

        console.log('Bekleyen arkadaşlık istekleri için realtime aboneliği başlatılıyor...');

        const pendingFriendChannel = supabase
            .channel('pending-friend-requests')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'friendships',
                filter: `user_id_2=eq.${currentUserId},status=eq.pending`
            }, async (payload) => {
                console.log('Yeni bekleyen arkadaşlık isteği alındı (realtime):', payload);

                // Bildirim sesi çal (eğer varsa)
                if (messageNotificationSound) {
                    try {
                        messageNotificationSound.currentTime = 0;
                        await messageNotificationSound.play();
                    } catch (error) {
                        console.warn('Bildirim sesi çalınamadı:', error);
                    }
                }

                // Bekleyen istekler sayacını güncelle
                await updatePendingRequestsCount();

                // Eğer bekleyen istekler sekmesi açıksa, istekleri yeniden yükle
                const activeTab = document.querySelector('.dashboard-header .tab.active');
                if (activeTab && activeTab.textContent.trim() === 'Bekleyen') {
                    loadPendingFriendRequests();
                }
            })
            .subscribe((status) => {
                console.log(`Bekleyen arkadaşlık istekleri abonelik durumu: ${status}`);
            });
    }

    // Sunucu Ekle (+) Butonu İşlevselliği
    const serverAddBtn = document.querySelector('.server-add-icon');
    const serverModal = document.getElementById('server-modal'); // HTML'deki ID bu
    const serverModalContainer = serverModal?.querySelector('.server-add-modal'); // İç container
    const closeServerModalBtn = serverModal?.querySelector('.close-server-modal-btn');

    if (serverAddBtn && serverModal && serverModalContainer && closeServerModalBtn) {
        console.log('Sunucu Ekle modal elementleri bulundu.');

        serverAddBtn.addEventListener('click', () => {
            console.log('Sunucu Ekle butonuna tıklandı');
            serverModal.style.display = 'flex';
            serverModal.style.opacity = '0'; // Başlangıçta şeffaf
            serverModalContainer.style.transform = 'scale(0.95) translateY(20px)'; // Başlangıç animasyon durumu
            serverModalContainer.style.opacity = '0';

            // Küçük bir gecikme ile animasyonu başlat
            setTimeout(() => {
                serverModal.style.opacity = '1';
                serverModalContainer.style.transform = 'scale(1) translateY(0)';
                serverModalContainer.style.opacity = '1';
            }, 10);
        });

        closeServerModalBtn.addEventListener('click', () => {
            console.log('Sunucu Ekle modalı kapatılıyor (buton).');
            serverModalContainer.style.transform = 'scale(0.95) translateY(20px)';
            serverModalContainer.style.opacity = '0';
            serverModal.style.opacity = '0';
            // Animasyon bittikten sonra gizle
            setTimeout(() => {
                serverModal.style.display = 'none';
            }, 300); // CSS transition süresiyle eşleşmeli
        });

        serverModal.addEventListener('click', (event) => {
            if (event.target === serverModal) {
                console.log('Sunucu Ekle modalı kapatılıyor (dış tık).');
                closeServerModalBtn.click(); // Kapatma butonunun olayını tetikle
            }
        });

        // TODO: Modal içindeki "Oluştur" ve "Katıl" butonlarına işlevsellik ekle
        //       (server-create-steps ve server-join-panel göster/gizle)
        // TODO: Geri butonlarına işlevsellik ekle

    } else {
        console.warn('Sunucu Ekle butonu veya modal elementleri bulunamadı.');
    }

} catch (error) {
    console.error('Dashboard başlatma hatası:', error);
    alert('Sayfa başlatılırken bir hata oluştu. Lütfen sayfayı yenileyiniz.');
}
