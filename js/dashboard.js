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

                // "Bekleyen" sekmesi için özel işlem
                if (tabName === 'Bekleyen') {
                    console.log("Bekleyen sekmesine tıklandı");

                    // Bir kez yükle
                    loadPendingFriendRequests();

                    // 200ms sonra tekrar yükle (çift tıklama etkisi)
                    setTimeout(() => {
                        console.log("Bekleyen sekmesi - ikinci yükleme");
                        loadPendingFriendRequests();
                    }, 200);
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
});

// Kullanıcı bilgilerini ve oturumu yönetme
async function initializeUserSession({ userPanelUsernameElement, userPanelAvatarElement }) {
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        if (user) {
            currentUserId = user.id;
            console.log('Kullanıcı ID:', currentUserId);

            // Kullanıcı profilini yükle
            await loadUserProfile({ userPanelUsernameElement, userPanelAvatarElement });

            return true;
        } else {
            console.error('Oturum açık değil, giriş sayfasına yönlendiriliyor.');
            redirectToLogin();
            return false;
        }
    } catch (error) {
        console.error('Kullanıcı bilgileri alınırken hata:', error);
        redirectToLogin();
        return false;
    }
}

// Login sayfasına yönlendirme
function redirectToLogin() {
    console.log('Oturum bulunamadı veya süresi doldu, giriş sayfasına yönlendiriliyor...');
    window.location.href = 'login.html';
}

// Kullanıcı profil bilgilerini yükleme
async function loadUserProfile({ userPanelUsernameElement, userPanelAvatarElement }) {
    if (!currentUserId) {
        console.error('loadUserProfile için currentUserId gerekli');
        return;
    }

    try {
        const { data: profile, error } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', currentUserId)
            .maybeSingle();

        if (error) {
            console.error('Profil bilgileri alınamadı:', error);
            setDefaultProfileUI({ userPanelUsernameElement, userPanelAvatarElement });
            return;
        }

        if (profile) {
            updateProfileUI({ profile, userPanelUsernameElement, userPanelAvatarElement });
        } else {
            console.warn(`${currentUserId} ID'li kullanıcı için profil bulunamadı`);
            setDefaultProfileUI({ userPanelUsernameElement, userPanelAvatarElement });
        }
    } catch (error) {
        console.error('Profil yüklenirken beklenmeyen hata:', error);
        setDefaultProfileUI({ userPanelUsernameElement, userPanelAvatarElement });
    }
}

// Profil UI güncellemesi
function updateProfileUI({ profile, userPanelUsernameElement, userPanelAvatarElement }) {
    if (userPanelUsernameElement) {
        userPanelUsernameElement.textContent = profile.username || 'Kullanıcı';
    }

    if (userPanelAvatarElement) {
        userPanelAvatarElement.src = profile.avatar || defaultAvatar;
        userPanelAvatarElement.onerror = () => {
            console.warn('Profil resmi yüklenemedi, varsayılan görsel kullanılıyor');
            userPanelAvatarElement.src = defaultAvatar;
        };
    }

    console.log('Profil arayüzü güncellendi:', profile.username);
}

// Varsayılan profil UI'ı
function setDefaultProfileUI({ userPanelUsernameElement, userPanelAvatarElement }) {
    if (userPanelUsernameElement) {
        userPanelUsernameElement.textContent = 'Kullanıcı';
    }

    if (userPanelAvatarElement) {
        userPanelAvatarElement.src = defaultAvatar;
    }
}

// Tüm arkadaşları yükleme fonksiyonu (optimize edilmiş)
async function loadAllFriends({ onlineList, offlineList, dmList, onlineSection, offlineSection }) {
    if (!onlineList || !offlineList || !dmList) {
        console.error('loadAllFriends: Arkadaş ve DM listesi elementleri bulunamadı');
        return;
    }

    // Yükleniyor göstergelerini göster
    showLoadingState();

    try {
        // Kullanıcı ID kontrolü
        if (!currentUserId) {
            console.error('loadAllFriends: currentUserId tanımlı değil');
            showError('Kullanıcı bilgisi bulunamadı. Lütfen sayfayı yenileyiniz.');
            return;
        }

        // Arkadaşlık verilerini çek
        const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`
                id, 
                user_id_1, 
                user_id_2,
                user1:user_id_1(id, username, avatar),
                user2:user_id_2(id, username, avatar)
            `)
            .eq('status', 'accepted')
            .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`);

        if (error) {
            throw error;
        }

        // Listeleri temizle
        clearLists();

        // Arkadaşlık yoksa boş durumu göster
        if (!friendships || friendships.length === 0) {
            showEmptyState();
            return;
        }

        // Arkadaşlıkları ekrana ekle - fragment kullanarak performansı artır
        const onlineFragment = document.createDocumentFragment();
        const offlineFragment = document.createDocumentFragment();
        const dmFragment = document.createDocumentFragment();

        friendships.forEach(friendship => {
            // Doğru arkadaş bilgisini al
            const friendUser = friendship.user_id_1 === currentUserId ? friendship.user2 : friendship.user1;

            if (!friendUser) {
                console.warn(`Friendship ${friendship.id} için arkadaş bilgisi bulunamadı`);
                return;
            }

            // Güvenli default değerler
            const username = friendUser.username || 'Bilinmeyen Kullanıcı';
            const avatar = friendUser.avatar || defaultAvatar;
            const userId = friendUser.id;

            // Arkadaş satırını oluştur
            const friendRow = createFriendRow(userId, username, avatar);

            // DM satırını oluştur
            const dmRow = createDMRow(userId, username, avatar, onlineFriends.has(userId));

            // Online durumuna göre ekle
            if (onlineFriends.has(userId)) {
                friendRow.classList.add('online');
                friendRow.classList.remove('offline');
                friendRow.querySelector('.status-dot').className = 'status-dot online';
                friendRow.querySelector('.friend-status').textContent = 'Çevrimiçi';
                onlineFragment.appendChild(friendRow);

                if (dmRow) {
                    const dmStatus = dmRow.querySelector('.dm-status');
                    const dmActivity = dmRow.querySelector('.dm-activity');

                    if (dmStatus) dmStatus.className = 'dm-status online';
                    if (dmActivity) dmActivity.textContent = 'Çevrimiçi';
                }
            } else {
                friendRow.classList.add('offline');
                friendRow.classList.remove('online');
                friendRow.querySelector('.status-dot').className = 'status-dot offline';
                friendRow.querySelector('.friend-status').textContent = 'Çevrimdışı';
                offlineFragment.appendChild(friendRow);

                if (dmRow) {
                    const dmStatus = dmRow.querySelector('.dm-status');
                    const dmActivity = dmRow.querySelector('.dm-activity');

                    if (dmStatus) dmStatus.className = 'dm-status offline';
                    if (dmActivity) dmActivity.textContent = 'Çevrimdışı';
                }
            }

            // DM satırını her zaman ekle
            if (dmRow) dmFragment.appendChild(dmRow);
        });

        // Fragmanları DOM'a ekle
        onlineList.appendChild(onlineFragment);
        offlineList.appendChild(offlineFragment);
        dmList.appendChild(dmFragment);

        // Sayaçları güncelle
        updateFriendCounters();

        // Kontekst menüleri ekle
        addContextMenuListeners();

    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
        showError('Arkadaşlar yüklenirken bir hata oluştu.');
    }

    // Yardımcı fonksiyonlar
    function showLoadingState() {
        onlineList.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Arkadaşlar yükleniyor...</div>';
        offlineList.innerHTML = '';
        dmList.innerHTML = '';

        // Sayaçları sıfırla
        const onlineCountBadge = document.querySelector('.online-count');
        const offlineCountBadge = document.querySelector('.offline-count');
        if (onlineCountBadge) onlineCountBadge.textContent = '0';
        if (offlineCountBadge) offlineCountBadge.textContent = '0';

        // Başlıkları gizle
        if (onlineSection) onlineSection.style.display = 'none';
        if (offlineSection) offlineSection.style.display = 'none';
    }

    function clearLists() {
        onlineList.innerHTML = '';
        offlineList.innerHTML = '';
        dmList.innerHTML = '';
    }

    function showEmptyState() {
        offlineList.innerHTML = '<div class="empty-placeholder">Henüz hiç arkadaşınız yok.</div>';
        dmList.innerHTML = '<div class="empty-placeholder dm-empty">Henüz hiç özel mesajınız yok.</div>';
        updateFriendCounters();
    }

    function showError(message) {
        onlineList.innerHTML = `<div class="error-placeholder">${message}</div>`;
        offlineList.innerHTML = '';
    }

    function createFriendRow(userId, username, avatar) {
        const friendElement = document.createElement('div');
        friendElement.className = 'friend-row';
        friendElement.dataset.userId = userId;
        friendElement.dataset.username = username;
        friendElement.dataset.avatar = avatar;

        friendElement.innerHTML = `
                    <div class="friend-avatar">
                <img src="${avatar}" alt="${username}" onerror="this.src='${defaultAvatar}'">
                        <span class="status-dot offline"></span>
                            </div>
                    <div class="friend-info">
                <div class="friend-name">${username}</div>
                <div class="friend-status">Çevrimdışı</div>
                    </div>
                `;

        return friendElement;
    }

    function createDMRow(userId, username, avatar, isOnline) {
        const dmElement = document.createElement('div');
        const statusClass = isOnline ? 'online' : 'offline';
        const statusText = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
        // .dm-item'a başlangıçta online/offline sınıfını ekleyelim
        dmElement.className = `dm-item ${statusClass}`;
        dmElement.dataset.userId = userId;
        dmElement.dataset.username = username;
        dmElement.dataset.avatar = avatar;

        dmElement.innerHTML = `
            <div class="dm-avatar">
                <img src="${avatar}" alt="${username}" onerror="this.src='${defaultAvatar}'">
                <div class="dm-status ${statusClass}"></div>
            </div>
            <div class="dm-info">
                <div class="dm-name">${username}</div>
                <div class="dm-activity">${statusText}</div>
            </div>
            <div class="dm-notification" style="display: none;"></div> 
        `;

        // DM öğesine tıklama event listener'ı ekle
        dmElement.addEventListener('click', () => {
            openChatPanel(userId, username, avatar);
            document.querySelectorAll('.dm-item').forEach(item => item.classList.remove('active'));
            dmElement.classList.add('active');
        });

        return dmElement;
    }
}

// Bekleyen istekleri yükleme
async function loadPendingRequests(pendingList, pendingCountBadge) {
    try {
        const { data: pendingRequests, error } = await supabase
            .from('friendships')
            .select('*')
            .eq('status', 'pending')
            .eq('user_id_2', currentUserId);

        if (error) {
            throw error;
        }

        // Bekleyen isteklerin sayısını göster
        const pendingCount = pendingRequests ? pendingRequests.length : 0;

        if (pendingList) pendingList.textContent = pendingCount;
        if (pendingCountBadge) pendingCountBadge.textContent = pendingCount;

        // Tüm sekmelerdeki bekleyen istek sayacını güncelle
        document.querySelectorAll('.pending-count').forEach(badge => {
            badge.textContent = pendingCount;
        });

        return pendingCount;
    } catch (error) {
        console.error('Bekleyen istekler yüklenirken hata:', error);
        if (pendingList) pendingList.textContent = 'Hata oluştu';
        if (pendingCountBadge) pendingCountBadge.textContent = 'Hata';
        return 0;
    }
}

// Bekleyen isteklerin sayısını güncelle
async function updatePendingRequestsCount() {
    try {
        const { data: pendingRequests, error } = await supabase
            .from('friendships')
            .select('count', { count: 'exact' })
            .eq('status', 'pending')
            .eq('user_id_2', currentUserId);

        if (error) {
            throw error;
        }

        const pendingCount = pendingRequests ? pendingRequests.length : 0;

        // Tüm bekleyen istek sayaçlarını güncelle
        document.querySelectorAll('.pending-count').forEach(badge => {
            badge.textContent = pendingCount;
        });

        return pendingCount;
    } catch (error) {
        console.error('Bekleyen istekler sayısı güncellenirken hata:', error);
        return 0;
    }
}

// Sunucu panelini kurma
function setupServerPanel() {
    // Ayarlar butonu için animasyonlu geçiş ekle
    const settingsButton = document.querySelector('.server-settings-icon');
    if (settingsButton) {
        settingsButton.addEventListener('click', function (e) {
            e.preventDefault();

            // Geçiş animasyonu
            document.body.classList.add('page-transition');

            // Kısa bir gecikme sonra yönlendirme yap
            setTimeout(() => {
                window.location.href = 'settings.html';
            }, 300);
        });
    }

    // Shop butonu için animasyonlu geçiş ekle
    const shopButton = document.querySelector('.server-shop-icon');
    if (shopButton) {
        shopButton.addEventListener('click', function (e) {
            e.preventDefault();

            // Geçiş animasyonu
            document.body.classList.add('page-transition');

            // Kısa bir gecikme sonra yönlendirme yap
            setTimeout(() => {
                window.location.href = 'shop.html';
            }, 300);
        });
    }
}

// Kontekst menüleri için dinleyicileri ekleme
function addContextMenuListeners() {
    const contextMenu = createContextMenuElement(); // Menü elementini oluştur veya bul
    document.body.appendChild(contextMenu); // Body'ye ekle (eğer yoksa)

    // Dinlenecek ana konteynerlar
    const listenAreas = [
        document.querySelector('.direct-messages'), // DM listesi
        document.querySelector('.friends-panel-container') // Arkadaş paneli
        // '.server-sidebar' // Gerekirse sunucu listesi de eklenebilir
    ];

    listenAreas.forEach(area => {
        if (!area) return;

        area.addEventListener('contextmenu', (e) => {
            // Hedef elementi bul
            const targetItem = e.target.closest('.dm-item, .friend-row'); // '.server-item' de eklenebilir

            if (targetItem) {
                e.preventDefault(); // Tarayıcının kendi menüsünü engelle

                // Hedef elementten verileri al
                const userId = targetItem.dataset.userId;
                const username = targetItem.dataset.username;
                const avatar = targetItem.dataset.avatar || defaultAvatar; // Avatar yoksa varsayılan

                if (!userId || !username) {
                    console.warn('Context menu target missing data:', targetItem.dataset);
                    hideContextMenu(contextMenu);
                    return;
                }

                // Menü içeriğini oluştur
                buildContextMenuContent(contextMenu, userId, username, avatar);

                // Menüyü göster
                showContextMenu(contextMenu, e.clientX, e.clientY);
            } else {
                // Geçerli bir hedef değilse menüyü gizle
                hideContextMenu(contextMenu);
            }
        });
    });

    // Sayfanın herhangi bir yerine tıklanınca menüyü gizle
    document.addEventListener('click', () => {
        hideContextMenu(contextMenu);
    });

    // Scroll olayında menüyü gizle (isteğe bağlı ama iyi bir UX)
    window.addEventListener('scroll', () => {
        hideContextMenu(contextMenu);
    }, true); // Capture phase'de dinle
}

// Bağlam menüsü elementini oluşturur veya mevcut olanı döndürür
function createContextMenuElement() {
    let menu = document.getElementById('custom-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        menu.className = 'context-menu'; // CSS sınıfını ekle
        menu.style.display = 'none'; // Başlangıçta gizli
    }
    return menu;
}

// Menü içeriğini dinamik olarak oluşturur
function buildContextMenuContent(menu, userId, username, avatar) {
    // Önceki içeriği temizle
    menu.innerHTML = '';

    // Başlık kısmı (Avatar ve İsim)
    const header = document.createElement('div');
    header.className = 'context-menu-header';
    header.innerHTML = `
        <div class="context-menu-avatar">
            <img src="${avatar}" alt="${username}" onerror="this.src='${defaultAvatar}'">
        </div>
        <span class="context-menu-name">${username}</span>
    `;
    menu.appendChild(header);

    // Ayırıcı
    const divider = document.createElement('div');
    divider.className = 'context-menu-divider';
    menu.appendChild(divider);

    // Menü Öğeleri
    const items = [
        { label: 'Profil', icon: 'fa-user', action: () => openProfilePanel(userId, username, avatar) },
        {
            label: 'Mesaj Gönder', icon: 'fa-comment', action: () => {
                // DM listesindeki avatarı bulup openChatPanel'e göndermek daha doğru olabilir
                // Şimdilik dataset'ten gelen avatarı kullanıyoruz
                openChatPanel(userId, username, avatar);
            }
        },
        {
            label: 'Arkadaşlıktan Çıkar',
            icon: 'fa-user-times',
            action: () => showRemoveFriendConfirmation(userId, username, avatar),
            danger: true
        }
    ];

    items.forEach(itemData => {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (itemData.danger) {
            menuItem.classList.add('danger'); // CSS'te .danger stili tanımlanmalı
        }
        menuItem.innerHTML = `
            <i class="fas ${itemData.icon}"></i>
            <span>${itemData.label}</span>
        `;
        menuItem.addEventListener('click', () => {
            itemData.action();
            hideContextMenu(menu); // İşlem sonrası menüyü gizle
        });
        menu.appendChild(menuItem);
    });
}

// Bağlam menüsünü gösterir
function showContextMenu(menu, x, y) {
    menu.style.display = 'block'; // Görünür yap

    // Menünün pencere dışına taşmasını engelle
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    if (x + menuWidth > windowWidth) {
        finalX = windowWidth - menuWidth - 5; // Sağ kenardan taşmayı engelle
    }
    if (y + menuHeight > windowHeight) {
        finalY = windowHeight - menuHeight - 5; // Alt kenardan taşmayı engelle
    }

    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;

    // Aktif sınıfını ekleyerek animasyonu tetikle (CSS'te tanımlıysa)
    setTimeout(() => menu.classList.add('active'), 0);
}

// Bağlam menüsünü gizler
function hideContextMenu(menu) {
    if (menu && menu.style.display === 'block') {
        menu.classList.remove('active'); // Animasyon sınıfını kaldır
        // Animasyonun bitmesini bekleyip gizle (transition süresi kadar)
        // setTimeout(() => {
        menu.style.display = 'none';
        // }, 150); // CSS'teki transition süresiyle eşleşmeli
    }
}

// initializePresence fonksiyon tanımı (içi boş kalsa da fonksiyonun var olması önemli)
function initializePresence() {
    // Bu fonksiyonun içeriği varsa korunmalı, yoksa boş kalabilir.
    // console.log("Presence sistemi başlatılıyor...");
}

async function openChatPanel(userId, username, avatar) {
    // Okunmamış mesaj sayacını sıfırla ve UI'ı güncelle
    if (unreadCounts[userId] && unreadCounts[userId] > 0) {
        console.log(`Sohbet açıldı, ${username} için okunmamışlar sıfırlanıyor.`);
        unreadCounts[userId] = 0;
        updateUnreadCountUI(userId, 0);
    }

    // Panel elementlerini al
    const chatPanel = document.querySelector('.chat-panel');
    const chatHeaderUser = chatPanel?.querySelector('.chat-header-user');
    const chatMessagesContainer = chatPanel?.querySelector('.chat-messages');
    const friendsPanelContainer = document.querySelector('.friends-panel-container');
    const sponsorSidebar = document.querySelector('.sponsor-sidebar');

    // Elementlerin varlığını kontrol et
    if (!chatPanel || !chatHeaderUser || !chatMessagesContainer || !friendsPanelContainer) {
        console.error('Chat panel elements not found, cannot open chat.');
        return;
    }
    console.log(`Sohbet paneli açılıyor (kullanıcı): ${username} (ID: ${userId})`);

    // Önce gerçek sohbet ID'sini bul/oluştur
    const actualConversationId = await findOrCreateConversation(currentUserId, userId);

    if (!actualConversationId) {
        console.error("Sohbet ID'si alınamadı veya oluşturulamadı.");
        alert("Sohbet başlatılamadı. Lütfen tekrar deneyin.");
        return; // Sohbet ID'si yoksa devam etme
    }

    // Global değişkeni GERÇEK sohbet ID'si ile güncelle
    currentConversationId = actualConversationId;
    console.log("Aktif sohbet ID'si (gerçek):", currentConversationId);

    // Sohbet başlığını güncelle
    const chatUsernameElement = chatHeaderUser.querySelector('.chat-username');
    const chatAvatarElement = chatHeaderUser.querySelector('.chat-avatar img');
    const chatStatusDot = chatHeaderUser.querySelector('.chat-avatar .status-dot');
    const chatStatusTextElement = chatHeaderUser.querySelector('.chat-user-info .chat-status');

    if (chatUsernameElement) chatUsernameElement.textContent = username;
    if (chatAvatarElement) chatAvatarElement.src = avatar || defaultAvatar;

    // Çevrimiçi durumunu kontrol et
    const isFriendOnline = onlineFriends.has(userId);
    const statusText = isFriendOnline ? 'Çevrimiçi' : 'Çevrimdışı';
    const statusClass = isFriendOnline ? 'online' : 'offline';
    if (chatStatusDot) chatStatusDot.className = `status-dot ${statusClass}`;
    if (chatStatusTextElement) chatStatusTextElement.textContent = statusText;

    // Mesajlar alanını temizle ve yükleniyor göster
    chatMessagesContainer.innerHTML = '';
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading-placeholder';
    loadingElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mesajlar yükleniyor...';
    chatMessagesContainer.appendChild(loadingElement);

    // Panelleri göster/gizle
    friendsPanelContainer.classList.add('hidden');
    if (sponsorSidebar) sponsorSidebar.style.display = 'none';
    chatPanel.classList.remove('hidden');

    // Aktif sohbetin user ID'sini panele ekle (durum güncellemesi için)
    chatPanel.dataset.activeChatUserId = userId;

    // Header butonlarının işlevselliğini ayarla
    setupChatHeaderActions(userId, username, avatar);

    // Mesajları GERÇEK sohbet ID'si ile yükle
    loadConversationMessages(currentConversationId);

    // Realtime aboneliği GERÇEK sohbet ID'si ile başlat
    subscribeToMessages(currentConversationId);
}

// Sohbet paneli header butonlarını ayarlama
function setupChatHeaderActions(userId, username, avatar) {
    // Chat header butonlarını ayarla
    const chatHeader = document.querySelector('.chat-panel .chat-header');
    const closeBtn = chatHeader?.querySelector('.chat-close-btn');
    const profileBtn = chatHeader?.querySelector('.profile-btn');

    // Sohbeti kapatma butonu
    if (closeBtn) {
        // Eski event listener'ları temizle
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Yeni event listener ekle
        newCloseBtn.addEventListener('click', closeChatPanel);
    }

    // Profil butonu
    if (profileBtn) {
        // Eski event listener'ları temizle
        const newProfileBtn = profileBtn.cloneNode(true);
        profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);

        // Profil butonuna tıklayınca profil panelini aç
        newProfileBtn.addEventListener('click', function () {
            openProfilePanel(userId, username, avatar);
        });
    }
}

// Sohbet panelini kapatma
function closeChatPanel() {
    const chatPanel = document.querySelector('.chat-panel');
    const friendsPanelContainer = document.querySelector('.friends-panel-container');
    const sponsorSidebar = document.querySelector('.sponsor-sidebar');

    if (!chatPanel || !friendsPanelContainer) return;

    // Paneli gizle
    chatPanel.classList.add('hidden');
    friendsPanelContainer.classList.remove('hidden');

    // Sponsor sidebar'ı göster (eğer varsa)
    if (sponsorSidebar) sponsorSidebar.style.display = '';

    // Aktif DM stilini kaldır
    document.querySelectorAll('.dm-item.active').forEach(item => item.classList.remove('active'));

    // Aktif sohbet ID'sini temizle
    currentConversationId = null;

    // Realtime aboneliğini sonlandır
    unsubscribeFromMessages();
}

// Kullanıcının mesajlarını yükleme
async function loadConversationMessages(conversationId) {
    const chatMessagesContainer = document.querySelector('.chat-panel .chat-messages');
    if (!chatMessagesContainer) return;

    try {
        console.log(`Mesajları yükleme (ConversationID: ${conversationId})`);

        // Sorguyu conversationId'ye göre yap
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversationId', conversationId)
            .order('createdAt', { ascending: true });

        if (error) {
            console.error('Mesaj sorgusunda hata:', error);
            throw error;
        }

        // Mesaj alanını temizle
        chatMessagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            const emptyElement = document.createElement('div');
            emptyElement.className = 'empty-placeholder chat-empty';
            emptyElement.textContent = 'Bu sohbetin başlangıcı.';
            chatMessagesContainer.appendChild(emptyElement);
            return;
        }

        console.log(`Toplam ${messages.length} mesaj bulundu`);

        // Gönderen kullanıcıların profil bilgilerini çek
        const senderIds = [...new Set(messages.map(msg => msg.senderId))];

        // Kullanıcı bilgilerini almak için Supabase sorgusu
        const { data: userProfiles, error: userError } = await supabase
            .from('users')
            .select('id, username, avatar')
            .in('id', senderIds);

        if (userError) {
            console.error('Kullanıcı profilleri alınırken hata:', userError);
        }

        // Kullanıcı ID'lerine göre profil bilgilerini eşleştir
        const userMap = {};
        if (userProfiles) {
            userProfiles.forEach(profile => {
                userMap[profile.id] = profile;
            });
        }

        // Tarih ayırıcılarını takip etmek için
        let lastMessageDate = null;

        // Fragment kullanarak DOM işlemlerini optimize et
        const fragment = document.createDocumentFragment();

        messages.forEach(message => {
            const senderId = message.senderId;
            const messageDate = new Date(message.createdAt).toLocaleDateString();
            if (messageDate !== lastMessageDate) {
                const dateDivider = document.createElement('div');
                dateDivider.className = 'chat-date-divider';
                dateDivider.innerHTML = `<span>${messageDate}</span>`;
                fragment.appendChild(dateDivider);
                lastMessageDate = messageDate;
            }

            let avatarUrl = defaultAvatar;
            let username = senderId === currentUserId ? 'Sen' : 'Kullanıcı';
            if (userMap[senderId]) {
                avatarUrl = userMap[senderId].avatar || defaultAvatar;
                username = userMap[senderId].username || username;
            }

            // Her mesajı displayMessage ile oluştur - DOM fragment'a ekleme displayMessage içinde yapılıyor
            displayMessage(message, username, avatarUrl, 'history'); // Kaynağı belirt
        });

        // Not: Artık fragment'ı burada append etmiyoruz, çünkü displayMessage her birini ekliyor.
        // chatMessagesContainer.appendChild(fragment);

        // Scrollu en alta indir (tüm mesajlar eklendikten sonra)
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    } catch (error) {
        console.error('Mesajlar yüklenirken hata oluştu:', error);
        chatMessagesContainer.innerHTML = '';
        const errorElement = document.createElement('div');
        errorElement.className = 'error-placeholder';
        errorElement.textContent = 'Mesajlar yüklenirken bir hata oluştu.';
        chatMessagesContainer.appendChild(errorElement);
    }
}

// Realtime mesaj aboneliği
async function subscribeToMessages(conversationId) {
    unsubscribeFromMessages(); // Önceki aboneliği iptal et

    if (!conversationId) {
        console.warn('subscribeToMessages: Geçerli conversationId gerekli.');
        return;
    }

    try {
        const channelName = `messages:${conversationId}`;
        console.log(`Mesaj kanalına abone olunuyor: ${channelName}`);

        messageSubscription = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversationId=eq.${conversationId}`
            }, async (payload) => {
                console.log('🔔 Realtime: Yeni mesaj payload alındı:', JSON.stringify(payload)); // Tüm payload'u logla

                if (payload.new && payload.new.senderId !== currentUserId) {
                    console.log('➡️ Realtime: Başkasından yeni mesaj alındı:', payload.new);
                    const senderId = payload.new.senderId;

                    // Aktif sohbet paneli bu gönderici için açık mı kontrol et
                    const chatPanel = document.querySelector('.chat-panel:not(.hidden)');
                    const activeChatUserId = chatPanel?.dataset.activeChatUserId;
                    const isChatOpenForSender = chatPanel && activeChatUserId === senderId;
                    console.log(`➡️ Realtime: Sohbet açık mı? Panel ID: ${activeChatUserId}, Gönderen ID: ${senderId} -> ${isChatOpenForSender}`);


                    // Gönderenin kullanıcı adını ve avatarını çek (displayMessage için)
                    let senderUsername = 'Kullanıcı';
                    let senderAvatar = defaultAvatar;
                    try {
                        const { data: profile, error } = await supabase
                            .from('users')
                            .select('username, avatar')
                            .eq('id', senderId)
                            .maybeSingle();
                        if (error) throw error;
                        if (profile) {
                            senderUsername = profile.username || senderUsername;
                            senderAvatar = profile.avatar || senderAvatar;
                        }
                    } catch (profileError) {
                        console.error('❌ Realtime: Profil alınırken hata:', profileError);
                    }

                    // Mesajı ekranda göster (sohbet açıksa)
                    if (isChatOpenForSender) {
                        console.log(`➡️ Realtime: Sohbet açık, mesaj gösteriliyor...`);
                        displayMessage(payload.new, senderUsername, senderAvatar, 'realtime'); // Kaynağı belirt
                    } else {
                        console.log(`➡️ Realtime: Sohbet kapalı, mesaj gösterilmiyor.`);
                    }

                    // Bildirim sesini çal (her durumda, sohbet açık olmasa bile)
                    if (messageNotificationSound) {
                        try {
                            messageNotificationSound.currentTime = 0;
                            await messageNotificationSound.play();
                        } catch (playError) {
                            console.warn('🔊 Bildirim sesi çalınamadı:', playError);
                        }
                    }

                    // Eğer sohbet açık değilse okunmamış sayacını artır ve UI'ı güncelle
                    if (!isChatOpenForSender) {
                        console.log(`➡️ Realtime: Okunmamış sayaç artırılıyor (Kullanıcı: ${senderId})`);
                        unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
                        updateUnreadCountUI(senderId, unreadCounts[senderId]);
                    }
                } else if (payload.new && payload.new.senderId === currentUserId) {
                    console.log('➡️ Realtime: Kendimizden yeni mesaj alındı (muhtemelen başka sekmeden):', payload.new);
                    // Kendi mesajımızsa ve sohbet açıksa, UI'ı güncelle (duplicate olmaması için kontrol edilebilir)
                    const chatPanel = document.querySelector('.chat-panel:not(.hidden)');
                    const activeChatUserId = chatPanel?.dataset.activeChatUserId;
                    // Conversation ID kontrolü de eklenebilir
                    if (chatPanel && payload.new.conversationId === currentConversationId) {
                        // Eğer mesaj zaten ekranda yoksa ekle
                        if (!document.querySelector(`.message-group[data-message-id='${payload.new.id}']`)) {
                            console.log('➡️ Realtime: Kendi mesajımız, ekranda yok, ekleniyor...');
                            displayMessage(payload.new, 'Sen', null, 'realtime-self');
                        } else {
                            console.log('➡️ Realtime: Kendi mesajımız, zaten ekranda.');
                        }
                    }
                }
            })
            .subscribe((status) => {
                console.log(`${channelName} abonelik durumu: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Başarıyla ${channelName} kanalına abone olundu.`);
                }
            });

    } catch (error) {
        console.error('❌ Mesaj aboneliğinde hata:', error);
    }
}

// Mesaj aboneliğini sonlandırma
function unsubscribeFromMessages() {
    if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
        messageSubscription = null;
    }
}

// Yeni bir mesajı ekrana görüntüleme (Detaylı loglama ve GIF JSON kontrolü)
// !!! DİKKAT: Template literal içinde HTML yorumları ({/* ... */}) KULLANMAYIN !!!
// !!! Bu tür yorumlar HTML olarak render edilir ve mesaj içeriğinde görünür hale gelir !!!
function displayMessage(message, authorName = null, authorAvatar = null, source = 'unknown') {
    const chatMessagesContainer = document.querySelector('.chat-panel .chat-messages');
    if (!chatMessagesContainer || !message) {
        console.error('displayMessage: Konteyner veya mesaj nesnesi eksik.');
        return;
    }

    console.log(`📬 displayMessage çağrıldı (Kaynak: ${source}) - Mesaj:`, JSON.stringify(message));

    const senderId = message.senderId;
    if (!senderId) {
        console.warn('displayMessage: Gelen mesajda senderId bulunamadı.', message);
        return;
    }

    let isGif = false;
    let gifUrl = '';
    let messageContent = message.content; // Varsayılan

    // Log the raw content
    console.log(`📄 displayMessage: Ham içerik (${source}):`, messageContent);

    // İçeriğin GIF JSON formatında olup olmadığını kontrol et
    if (typeof messageContent === 'string' && messageContent.startsWith('{')) {
        try {
            const contentData = JSON.parse(messageContent);
            console.log(`🔍 displayMessage: JSON ayrıştırıldı (${source}):`, contentData);
            if (contentData && contentData.type === 'gif' && contentData.url) {
                isGif = true;
                gifUrl = contentData.url;
                console.log(`✅ displayMessage: GIF mesajı algılandı (${source}):`, gifUrl);
            } else {
                console.log(`ℹ️ displayMessage: JSON formatı, ancak GIF değil (${source}).`);
                // JSON ama GIF değilse, şimdilik JSON string'i olarak gösterelim
                // Belki gelecekte başka JSON tipleri de olabilir?
                // messageContent değişkeni zaten ham JSON string'i içeriyor.
            }
        } catch (e) {
            console.log(`⚠️ displayMessage: JSON ayrıştırma hatası (${source}), düz metin olarak işlenecek:`, e.message);
            // Hata durumunda messageContent zaten ham içeriği tutuyor.
        }
    } else {
        console.log(`📄 displayMessage: Düz metin mesajı algılandı (${source}).`);
    }

    // Kimin mesajı olduğunu ve gösterilecek bilgileri belirle
    const isOwnMessage = senderId === currentUserId;
    const displayName = isOwnMessage ? 'Sen' : (authorName || 'Kullanıcı');
    let displayAvatar = defaultAvatar;

    if (isOwnMessage) {
        const userAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');
        if (userAvatarElement) displayAvatar = userAvatarElement.src;
    } else {
        displayAvatar = authorAvatar || document.querySelector('.chat-avatar img')?.src || defaultAvatar;
    }

    // Mesaj öğesini oluştur
    const messageElement = document.createElement('div');
    messageElement.className = `message-group ${isOwnMessage ? 'own-message' : ''}`;
    messageElement.setAttribute('data-sender-id', senderId);
    messageElement.setAttribute('data-message-id', message.id || 'local-' + Date.now()); // Mesaj ID ekle

    // HTML şablonu oluştur (GIF veya metin için)
    const messageTime = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isGif) {
        console.log(`🖼️ displayMessage: GIF render ediliyor (${source}):`, gifUrl);
        // GIF mesajı
        messageElement.innerHTML = `
        <div class="message-group-avatar">
            <img src="${displayAvatar}" alt="${displayName}" onerror="this.src='${defaultAvatar}'">
        </div>
        <div class="message-group-content">
            <div class="message-group-header">
                <span class="message-author">${displayName}</span>
                    <span class="message-time">${messageTime}</span>
                </div>
                <div class="message-content gif-message">
                    <img src="${gifUrl}" alt="GIF" class="message-gif" loading="lazy">
                </div>
            </div>
        `;
    } else {
        console.log(`📝 displayMessage: Metin render ediliyor (${source}):`, messageContent);
        // Normal metin mesajı
        messageElement.innerHTML = `
        <div class="message-group-avatar">
            <img src="${displayAvatar}" alt="${displayName}" onerror="this.src='${defaultAvatar}'">
        </div>
        <div class="message-group-content">
            <div class="message-group-header">
                <span class="message-author">${displayName}</span>
                <span class="message-time">${messageTime}</span>
            </div>
            <div class="message-content">
                <p>${messageContent}</p>
            </div>
        </div>
    `;
    }

    chatMessagesContainer.appendChild(messageElement);
    // Scroll en alta, ama sadece kullanıcı en altta ise veya kendi mesajıysa?
    // Şimdilik her zaman scroll yapalım.
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function setupMessageSending(chatTextarea) {
    if (!chatTextarea) {
        console.error('setupMessageSending: chatTextarea elementi bulunamadı');
        return;
    }

    // Eski listener'ları temizle (varsa)
    const newTextarea = chatTextarea.cloneNode(true);
    if (chatTextarea.parentNode) {
        chatTextarea.parentNode.replaceChild(newTextarea, chatTextarea);
    }

    // Enter tuşu ile mesaj gönderme
    newTextarea.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(newTextarea);
        }
    });

    // Gönder butonu için event listener
    const sendButton = document.querySelector('.chat-textbox .send-message-btn');
    if (sendButton) {
        const newSendButton = sendButton.cloneNode(true);
        if (sendButton.parentNode) {
            sendButton.parentNode.replaceChild(newSendButton, sendButton);
        }

        newSendButton.addEventListener('click', () => {
            sendMessage(newTextarea);
        });
    }

    // Mesaj gönderme yardımcı fonksiyonu
    async function sendMessage(textarea) {
        const messageText = textarea.value.trim();
        if (!messageText || !currentConversationId) {
            console.warn('Mesaj göndermek için içerik ve geçerli conversationId gerekli.');
            return;
        }

        console.log(`Mesaj gönderiliyor: ${messageText} (ConversationID: ${currentConversationId}, SenderID: ${currentUserId})`);

        try {
            // Insert edilecek veriye conversationId'yi ekle
            const messageData = {
                content: messageText,
                senderId: currentUserId,
                conversationId: currentConversationId, // CHECK kuralı için eklendi
                // receiverId'yi ayrıca göndermeye gerek yok, conversationId yeterli olabilir.
                // Eğer tablo yapınızda receiverId zorunluysa, onu da ekleyebilirsiniz:
                // receiverId: currentConversationId // Bu isimlendirme kafa karıştırıcı, 
                // currentConversationId aslında diğer kullanıcının ID'si
                // DM sisteminde conversationId'nin neyi temsil ettiğini netleştirmek iyi olur.
            };

            console.log('Eklenecek mesaj verisi:', messageData);

            const { data, error } = await supabase
                .from('messages')
                .insert([messageData])
                .select();

            if (error) {
                console.error('Mesaj eklenirken Supabase hatası:', error);
                // Hata detayını kullanıcıya göstermeyi düşünebilirsiniz
                if (error.code === '23514') { // Check constraint hatası
                    alert('Mesaj gönderilemedi. (Kural İhlali: ' + error.message + ')');
                } else {
                    alert('Mesaj gönderilemedi. Lütfen tekrar deneyiniz.');
                }
                throw error; // Hatayı tekrar fırlatarak işlemi durdur
            }

            // Mesaj alanını temizle
            textarea.value = '';

            // Başarılı mesaj gönderildiyse ve veri döndüyse ekranda göster
            if (data && data.length > 0) {
                console.log('Mesaj başarıyla gönderildi:', data[0]);
                displayMessage(data[0]); // displayGifMessage yerine displayMessage çağır
            }

        } catch (error) {
            // Zaten yukarıda loglandı ve kullanıcıya alert gösterildi.
            // Burada ek bir işlem yapmaya gerek yok.
            // console.error('Mesaj gönderilirken genel hata:', error);
        }
    }
}

function updateFriendCounters() {
    // Çevrimiçi arkadaş sayacı
    const onlineCount = document.querySelector('.online-count');
    const onlineFriendElements = document.querySelectorAll('.online-friends .friend-row');
    if (onlineCount) {
        onlineCount.textContent = onlineFriendElements.length;
    }

    // Çevrimdışı arkadaş sayacı
    const offlineCount = document.querySelector('.offline-count');
    const offlineFriendElements = document.querySelectorAll('.offline-friends .friend-row');
    if (offlineCount) {
        offlineCount.textContent = offlineFriendElements.length;
    }

    // Başlıkların görünürlüğünü ayarla
    const onlineSection = document.querySelector('.online-section-title');
    const offlineSection = document.querySelector('.offline-section-title');

    if (onlineSection) {
        onlineSection.style.display = onlineFriendElements.length > 0 ? 'flex' : 'none';
    }

    if (offlineSection) {
        offlineSection.style.display = offlineFriendElements.length > 0 ? 'flex' : 'none';
    }
}

// İki kullanıcı arasındaki DM sohbetini bulur veya oluşturur
async function findOrCreateConversation(userId1, userId2) {
    if (!userId1 || !userId2) {
        console.error("findOrCreateConversation: İki kullanıcı ID'si de gerekli.");
        return null;
    }
    // Kendisiyle sohbeti engelle (isteğe bağlı ama önerilir)
    if (userId1 === userId2) {
        console.warn("Kendinizle sohbet oluşturamazsınız.");
        return null;
    }
    console.log(`DM Sohbeti aranıyor/oluşturuluyor: ${userId1} ve ${userId2}`);

    try {
        // Mevcut DM sohbetini ara: participantIds her iki kullanıcıyı da içermeli VE isGroup=false olmalı
        const participants = [userId1, userId2].sort(); // Tutarlılık için ID'leri sırala
        const { data: existingConversation, error: findError } = await supabase
            .from('conversations')
            .select('id')
            // participantIds dizisinin her iki kullanıcıyı da içerdiğini kontrol et (@> operatörü)
            .contains('participantIds', participants)
            // Sadece DM sohbetlerini bul (grup olmayanları)
            .eq('isGroup', false)
            .maybeSingle();

        if (findError) {
            console.error("Sohbet aranırken hata:", findError);
            throw findError;
        }

        // Sohbet bulunduysa ID'sini döndür
        if (existingConversation) {
            console.log("Mevcut DM sohbeti bulundu:", existingConversation.id);
            return existingConversation.id;
        }

        // Sohbet yoksa yeni bir DM sohbeti oluştur
        console.log("Mevcut DM sohbeti bulunamadı, yenisi oluşturuluyor...");
        const { data: newConversation, error: createError } = await supabase
            .from('conversations')
            .insert([
                {
                    participantIds: participants, // Sıralanmış ID dizisini ekle
                    isGroup: false // Bunun bir DM sohbeti olduğunu belirt
                    // groupName, groupAvatar null olabilir veya varsayılan değer atanabilir
                }
            ])
            .select('id')
            .single();

        if (createError) {
            console.error("Yeni DM sohbeti oluşturulurken hata:", createError);
            // RLS veya başka kısıtlamalar olabilir
            if (createError.message.includes("security policies")) {
                alert("Yeni sohbet oluşturulamadı. Güvenlik politikaları (RLS) INSERT işlemini engelliyor olabilir.");
            } else if (createError.message.includes("violates check constraint")) {
                alert("Yeni sohbet oluşturulamadı. Bir CHECK kuralı ihlal edilmiş olabilir (örn: participantIds boş olamaz).");
            } else if (createError.message.includes("violates not-null constraint")) {
                alert("Yeni sohbet oluşturulamadı. Gerekli bir sütun (örn: isGroup) boş bırakılmış olabilir.");
            }
            throw createError;
        }

        if (newConversation) {
            console.log("Yeni DM sohbeti oluşturuldu:", newConversation.id);
            return newConversation.id;
        } else {
            console.error("Sohbet oluşturuldu ancak Supabase ID döndürmedi.");
            throw new Error("Sohbet oluşturuldu ancak ID alınamadı.");
        }

    } catch (error) {
        console.error("findOrCreateConversation içinde genel hata:", error);
        alert("Sohbet bilgisi alınırken veya oluşturulurken bir hata oluştu. Konsolu kontrol edin.")
        return null;
    }
}

// Emoji picker'ı kuran fonksiyon
function setupEmojiPicker(emojiButton, textareaElement, emojiPickerElement) {
    console.log('🔄 Emoji sistemi odak sorunu için yeniden düzenleniyor...');

    // Mevcut emoji picker'ları temizle
    const oldContainer = document.getElementById('emoji-picker-container');
    if (oldContainer) {
        oldContainer.remove();
    }

    // Emoji container oluştur - textareaElement'in yakınına eklenecek
    const emojiContainer = document.createElement('div');
    emojiContainer.id = 'emoji-picker-container';
    emojiContainer.style.position = 'absolute';
    emojiContainer.style.width = '350px';
    emojiContainer.style.zIndex = '10000';
    emojiContainer.style.display = 'none';
    emojiContainer.style.backgroundColor = '#1e1e2d';
    emojiContainer.style.border = '1px solid #2d2d3f';
    emojiContainer.style.borderRadius = '8px';
    emojiContainer.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';

    // Emoji picker'ı textarea'nın bulunduğu konteynere ekle
    const messageInputContainer = findTextareaContainer(textareaElement);
    if (messageInputContainer) {
        messageInputContainer.appendChild(emojiContainer);
        messageInputContainer.style.position = 'relative';
    } else {
        // Alternatif olarak body'ye ekle
        document.body.appendChild(emojiContainer);
    }

    // Emoji kategorileri oluştur
    const categories = [
        { name: 'Yüzler', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍'] },
        { name: 'El Hareketleri', emojis: ['👋', '🤚', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '💌', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍'] },
        { name: 'Bayraklar', emojis: ['🇹🇷', '🇺🇸', '🇬🇧', '🇩🇪', '🇫🇷', '🇮🇹', '🇯🇵', '🇰🇷', '🇨🇳', '🇷🇺', '🇨🇦', '🇦🇺', '🇧🇷', '🇪🇸', '🇮🇳', '🇲🇽', '🇦🇷', '🇮🇩', '🇸🇦', '🇿🇦', '🇪🇬', '🇵🇰', '🇳🇿', '🇳🇱', '🇧🇪', '🇮🇷', '🇺🇦', '🇸🇪', '🇳🇴', '🇩🇰', '🇵🇱', '🇭🇺', '🇫🇮', '🇦🇹', '🇨🇭', '🇵🇹', '🇬🇷', '🇮🇱'] }
    ];

    // ÖZEL: Textarea'nın konteynerini bulma
    function findTextareaContainer(textarea) {
        if (!textarea) return null;

        // Textarea'nın ebeveyn elementlerini kontrol et
        let parent = textarea.parentElement;
        while (parent && parent !== document.body) {
            // Form, div veya benzer bir konteyner olabilir
            if (parent.classList.contains('message-input') ||
                parent.classList.contains('chat-input') ||
                parent.classList.contains('input-container')) {
                return parent;
            }
            parent = parent.parentElement;
        }

        // En yakın ebeveyn div'i bul
        return textarea.closest('div');
    }

    // Emoji klavyesi oluştur
    function createEmojiKeyboard() {
        emojiContainer.innerHTML = '';

        // Kategori seçicisi
        const categorySelector = document.createElement('div');
        categorySelector.style.display = 'flex';
        categorySelector.style.borderBottom = '1px solid #2d2d3f';
        categorySelector.style.padding = '8px';

        categories.forEach((category, index) => {
            const categoryButton = document.createElement('button');
            categoryButton.innerText = category.name;
            categoryButton.style.flex = '1';
            categoryButton.style.border = 'none';
            categoryButton.style.background = index === 0 ? '#3a3a4f' : 'transparent';
            categoryButton.style.color = '#fff';
            categoryButton.style.padding = '8px';
            categoryButton.style.borderRadius = '4px';
            categoryButton.style.margin = '0 4px';
            categoryButton.style.cursor = 'pointer';

            categoryButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Aktif kategoriyi güncelle
                categorySelector.querySelectorAll('button').forEach(btn => {
                    btn.style.background = 'transparent';
                });
                categoryButton.style.background = '#3a3a4f';

                // Emoji grid'i güncelle
                updateEmojiGrid(category);

                // TEXTAREAYİ ODAKLI TUT
                const textarea = getMessageTextarea();
                if (textarea) {
                    const cursorPos = textarea.selectionStart;
                    textarea.focus();
                    textarea.setSelectionRange(cursorPos, cursorPos);
                }
            });

            categorySelector.appendChild(categoryButton);
        });

        emojiContainer.appendChild(categorySelector);

        // Emoji grid container
        const emojiGrid = document.createElement('div');
        emojiGrid.style.display = 'grid';
        emojiGrid.style.gridTemplateColumns = 'repeat(8, 1fr)';
        emojiGrid.style.gap = '5px';
        emojiGrid.style.padding = '10px';
        emojiGrid.style.maxHeight = '250px';
        emojiGrid.style.overflowY = 'auto';
        emojiContainer.appendChild(emojiGrid);

        // İlk kategoriyi göster
        updateEmojiGrid(categories[0]);
    }

    // Emoji grid'i güncelle
    function updateEmojiGrid(category) {
        const emojiGrid = emojiContainer.querySelector('div:last-child');
        emojiGrid.innerHTML = '';

        category.emojis.forEach(emoji => {
            const emojiButton = document.createElement('button');
            emojiButton.innerText = emoji;
            emojiButton.style.background = 'transparent';
            emojiButton.style.border = 'none';
            emojiButton.style.fontSize = '20px';
            emojiButton.style.cursor = 'pointer';
            emojiButton.style.padding = '5px';
            emojiButton.style.borderRadius = '4px';
            emojiButton.style.transition = 'background 0.2s';

            emojiButton.addEventListener('mouseover', () => {
                emojiButton.style.background = '#3a3a4f';
            });

            emojiButton.addEventListener('mouseout', () => {
                emojiButton.style.background = 'transparent';
            });

            emojiButton.addEventListener('mousedown', (e) => {
                // mousedown olayını durdur - textarea'dan odak kaybını önler
                e.preventDefault();
                e.stopPropagation();

                // Emoji ekle
                console.log(`🎯 Emoji seçildi: ${emoji}`);
                insertEmojiDirectly(emoji);

                // TEXTAREAYİ ODAKLI TUT - TEXTAREAYİ TEKRAR BULMAYA GEREK YOK
                const textarea = getMessageTextarea();
                if (textarea) {
                    // Yeni imleç pozisyonu - emoji uzunluğu kadar ileriye taşı
                    const newPos = textarea.selectionStart;
                    textarea.focus();
                    textarea.setSelectionRange(newPos, newPos);
                }

                // Picker'ı kapatma (opsiyonel)
                // emojiContainer.style.display = 'none';
            });

            emojiGrid.appendChild(emojiButton);
        });
    }

    // Mesaj alanı referansını doğru alma stratejisi
    function getMessageTextarea() {
        // Eğer parametre olarak gelen textareaElement geçerliyse kullan
        if (textareaElement && textareaElement.nodeName === 'TEXTAREA') {
            console.log('✅ Parametre olarak gelen textarea kullanılıyor');
            return textareaElement;
        }

        // "Bir mesaj yazın..." placeholder'ı ile ara
        console.log('🔍 "Bir mesaj yazın..." placeholder ile textarea aranıyor');
        const allTextareas = document.querySelectorAll('textarea');
        for (let textarea of allTextareas) {
            if (textarea.placeholder && (
                textarea.placeholder.includes('mesaj yazın') ||
                textarea.placeholder.includes('Bir mesaj')
            )) {
                console.log('✅ Placeholder ile textarea bulundu:', textarea.placeholder);
                return textarea;
            }
        }

        // Aktif sohbet panelinde ara
        const chatPanel = document.querySelector('.chat-panel.active');
        if (chatPanel) {
            const textarea = chatPanel.querySelector('textarea');
            if (textarea) {
                console.log('✅ Aktif sohbet panelinde textarea bulundu');
                return textarea;
            }
        }

        // Son çare: sayfadaki son textarea
        const lastTextarea = document.querySelector('textarea:last-of-type');
        if (lastTextarea) {
            console.log('⚠️ Son çare: Sayfadaki son textarea kullanılıyor');
            return lastTextarea;
        }

        console.error('❌ Hiçbir textarea bulunamadı!');
        return null;
    }

    // Emoji'yi doğrudan textarea'ya ekle
    function insertEmojiDirectly(emoji) {
        const textarea = getMessageTextarea();
        if (!textarea) {
            console.error('❌ Emoji eklemek için textarea bulunamadı!');
            return;
        }

        try {
            // Emoji ekleme işlemini gerçekleştir
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const before = text.substring(0, start);
            const after = text.substring(end, text.length);

            // Yeni metni oluştur ve textarea'ya uygula
            textarea.value = before + emoji + after;

            // İmleci emoji sonrasına taşı
            const newPosition = start + emoji.length;
            textarea.selectionStart = textarea.selectionEnd = newPosition;

            // Değişikliği tetiklemek için input event'i gönder
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // ÖNEMLİ: Textarea'ya odaklanmayı garantile
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(newPosition, newPosition);
                console.log('✅ Emoji eklendi ve imleç doğru konumda:', newPosition);
            }, 10);

            console.log('✅ Emoji başarıyla eklendi:', emoji);
        } catch (error) {
            console.error('❌ Emoji eklenirken hata oluştu:', error);

            // Yedek yöntem dene: document.execCommand
            try {
                textarea.focus();
                document.execCommand('insertText', false, emoji);
                console.log('✅ Yedek yöntemle emoji eklendi');

                // Yedek yöntemde de odaklanmayı garantile
                setTimeout(() => {
                    textarea.focus();
                }, 10);
            } catch (backupError) {
                console.error('❌ Yedek yöntem de başarısız oldu:', backupError);
            }
        }
    }

    // Emoji butonuna tıklandığında
    emojiButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Mevcut textarea'yı bul ve referansını sakla
        const activeTextarea = getMessageTextarea();
        if (!activeTextarea) {
            console.error('❌ Aktif textarea bulunamadı!');
            return;
        }

        // Textarea içeriğini ve imleç pozisyonunu sakla
        const cursorPos = activeTextarea.selectionStart;
        const textContent = activeTextarea.value;

        const isVisible = emojiContainer.style.display === 'block';

        // Toggle emoji picker görünürlüğü
        if (isVisible) {
            emojiContainer.style.display = 'none';
        } else {
            // Konumlandırma
            const buttonRect = emojiButton.getBoundingClientRect();
            const bottom = window.innerHeight - buttonRect.top;
            const right = window.innerWidth - buttonRect.right;

            emojiContainer.style.bottom = `${bottom + 10}px`;
            emojiContainer.style.right = `${right + 10}px`;

            // Emoji klavyesini oluştur
            createEmojiKeyboard();

            // Göster
            emojiContainer.style.display = 'block';
        }

        // ÖNEMLİ: Textarea'ya odağı geri ver ve imleç pozisyonunu koru
        setTimeout(() => {
            activeTextarea.focus();
            activeTextarea.setSelectionRange(cursorPos, cursorPos);
            console.log('✅ Textarea odağı korundu, imleç pozisyonu:', cursorPos);
        }, 10);
    });

    // Dışarı tıklandığında emoji paneli kapat
    document.addEventListener('click', (e) => {
        if (emojiContainer.style.display === 'block' &&
            e.target !== emojiButton &&
            !emojiContainer.contains(e.target)) {
            emojiContainer.style.display = 'none';
        }
    });

    console.log('✅ Yeni emoji sistemi kurulumu tamamlandı');
}

// Modal gösterme fonksiyonu
function showModal(modalElement) {
    if (modalElement) {
        console.log('Modal açılıyor:', modalElement.id);

        // Modal görünürlük ve animasyon ayarları
        modalElement.style.display = 'flex';
        modalElement.style.opacity = '0';
        modalElement.classList.add('show-modal');

        // Modal içeriği için animasyon
        const modalContainer = modalElement.querySelector('.modal-container');
        if (modalContainer) {
            modalContainer.classList.add('show-modal');
            modalContainer.style.transform = 'scale(0.95)';
            modalContainer.style.opacity = '0';
        }

        // Animasyon sonrası tam görünürlük
        setTimeout(() => {
            modalElement.style.opacity = '1';
            if (modalContainer) {
                modalContainer.style.transform = 'scale(1)';
                modalContainer.style.opacity = '1';
            }
        }, 10);
    } else {
        console.error('Modal elementi bulunamadı');
    }
}

// Modal gizleme fonksiyonu
function hideModal(modalElement) {
    if (modalElement) {
        console.log('Modal kapatılıyor:', modalElement.id);

        // Önce opacity'yi azalt (animasyon etkisi için)
        modalElement.style.opacity = '0';

        // Modal içeriği animasyonu
        const modalContainer = modalElement.querySelector('.modal-container');
        if (modalContainer) {
            modalContainer.style.transform = 'scale(0.95)';
            modalContainer.style.opacity = '0';
        }

        // Animasyon için zaman tanı
        setTimeout(() => {
            modalElement.style.display = 'none';
            modalElement.classList.remove('show-modal');

            // Modal içeriği animasyonu sıfırla
            if (modalContainer) {
                modalContainer.classList.remove('show-modal');
            }
        }, 300);
    }
}

// Arkadaş Ekle modalını kur
function setupAddFriendModal() {
    console.log('Arkadaş Ekle modal kurulumu başladı');
    const addFriendButton = document.getElementById('add-friend-button');
    const addFriendModal = document.getElementById('addFriendModal');
    const closeModalButton = addFriendModal?.querySelector('.close-modal-btn');
    const addFriendForm = addFriendModal?.querySelector('#add-friend-form');
    const usernameInput = addFriendModal?.querySelector('#add-friend-username-input');
    const messageArea = addFriendModal?.querySelector('.modal-message-area');

    if (!addFriendButton || !addFriendModal || !closeModalButton || !addFriendForm || !usernameInput || !messageArea) {
        console.warn('Arkadaş Ekle modal elementleri bulunamadı. Buton işlevsiz olabilir.');
        console.warn('Eksik elementler:', {
            addFriendButton: !addFriendButton,
            addFriendModal: !addFriendModal,
            closeModalButton: !closeModalButton,
            addFriendForm: !addFriendForm,
            usernameInput: !usernameInput,
            messageArea: !messageArea
        });
        return;
    }

    console.log('Arkadaş Ekle modal elementleri bulundu');

    // Show modal when Add Friend button is clicked
    addFriendButton.addEventListener('click', (event) => {
        console.log('Arkadaş Ekle butonuna tıklandı');
        event.preventDefault();
        event.stopPropagation();
        showModal(addFriendModal);
        usernameInput.focus();
        // Clear previous messages
        messageArea.style.display = 'none';
        messageArea.textContent = '';
        messageArea.className = 'modal-message-area';
    });

    // Hide modal when close button is clicked
    closeModalButton.addEventListener('click', () => {
        hideModal(addFriendModal);
    });

    // Hide modal when clicking outside the modal content
    addFriendModal.addEventListener('click', (event) => {
        if (event.target === addFriendModal) {
            hideModal(addFriendModal);
        }
    });

    // Handle form submission
    addFriendForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        const submitButton = addFriendForm.querySelector('.modal-submit-button');

        if (!username) {
            displayModalMessage('Lütfen bir kullanıcı adı girin.', 'error', messageArea);
            return;
        }

        if (submitButton) submitButton.disabled = true;
        displayModalMessage('Arkadaşlık isteği gönderiliyor...', 'info', messageArea);

        try {
            // 1. Find the user by username
            const { data: users, error: findError } = await supabase
                .from('users')
                .select('id')
                .eq('username', username)
                .neq('id', currentUserId);

            if (findError) throw new Error(`Kullanıcı aranırken hata: ${findError.message}`);
            if (!users || users.length === 0) {
                throw new Error(`'${username}' kullanıcısı bulunamadı.`);
            }
            if (users.length > 1) {
                throw new Error(`'${username}' ile eşleşen birden fazla kullanıcı bulundu. Lütfen daha belirgin bir kullanıcı adı deneyin.`);
            }

            const friendId = users[0].id;

            // 2. Check if already friends or request pending - SORGU DÜZELTİLDİ
            console.log('Arkadaşlık kontrolü yapılıyor:', currentUserId, friendId);

            // Önceki hatalı sorgu:
            // .or(`user_id_1.eq.${currentUserId},and(user_id_2.eq.${friendId}),user_id_1.eq.${friendId},and(user_id_2.eq.${currentUserId})`)

            // Düzeltilmiş sorgu - OR içindeki tüm kombinasyonları doğru şekilde kontrol eder
            const { data: existingFriendship, error: checkError } = await supabase
                .from('friendships')
                .select('id, status')
                .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${currentUserId})`)
                .maybeSingle();

            console.log('Arkadaşlık sorgu sonucu:', existingFriendship);

            if (checkError) throw new Error(`Arkadaşlık durumu kontrol edilirken hata: ${checkError.message}`);

            if (existingFriendship) {
                if (existingFriendship.status === 'accepted') {
                    throw new Error(`'${username}' ile zaten arkadaşsınız.`);
                } else if (existingFriendship.status === 'pending') {
                    throw new Error(`'${username}' kullanıcısına zaten bir istek gönderilmiş veya ondan bir istek var.`);
                } else if (existingFriendship.status === 'blocked') {
                    throw new Error(`Bu kullanıcıyla etkileşim kuramazsınız.`);
                }
            }

            // 3. Send friend request
            const { error: insertError } = await supabase
                .from('friendships')
                .insert({
                    user_id_1: currentUserId,
                    user_id_2: friendId,
                    status: 'pending'
                });

            if (insertError) throw new Error(`Arkadaşlık isteği gönderilirken hata: ${insertError.message}`);

            displayModalMessage(`'${username}' kullanıcısına arkadaşlık isteği gönderildi!`, 'success', messageArea);
            usernameInput.value = '';

        } catch (error) {
            console.error('Arkadaş ekleme hatası:', error);
            displayModalMessage(error.message || 'Bir hata oluştu.', 'error', messageArea);
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// Helper function to display messages inside the modal
function displayModalMessage(message, type, messageAreaElement) {
    if (messageAreaElement) {
        messageAreaElement.textContent = message;
        // Reset classes and add the new type
        messageAreaElement.className = 'modal-message-area'; // Base class
        messageAreaElement.classList.add(type); // 'success', 'error', or 'info'
        messageAreaElement.style.display = 'flex'; // Show the message area
    }
}

// Belirli bir kullanıcı için okunmamış mesaj sayısını UI'da günceller
function updateUnreadCountUI(userId, count) {
    const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
    if (!dmItem) return;

    const notificationBadge = dmItem.querySelector('.dm-notification');
    if (!notificationBadge) return;

    console.log(`Okunmamış UI Güncelle: Kullanıcı ${userId}, Sayı: ${count}`);

    if (count > 0) {
        notificationBadge.textContent = count > 99 ? '99+' : count; // Limitleme ekleyebiliriz
        notificationBadge.style.display = 'flex';
    } else {
        notificationBadge.style.display = 'none';
        notificationBadge.textContent = ''; // İçeriği temizle
    }
}

// Arkadaşlıktan çıkarma onay modalını gösterme
function showRemoveFriendConfirmation(userId, username, avatar) {
    // Daha önce modal oluşturulduysa kaldır
    let confirmModal = document.getElementById('removeFriendModal');
    if (confirmModal) {
        document.body.removeChild(confirmModal);
    }

    // Yeni modal oluştur
    confirmModal = document.createElement('div');
    confirmModal.id = 'removeFriendModal';
    confirmModal.className = 'modal-overlay';
    confirmModal.style.display = 'none';

    confirmModal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <div class="modal-icon"><i class="fas fa-user-times"></i></div>
                <h3>Arkadaş Silme</h3>
                <button class="close-modal-btn" title="Kapat">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-content">
                <div class="remove-friend-info">
                    <img src="${avatar}" alt="${username}" class="remove-friend-avatar" onerror="this.src='${defaultAvatar}'">
                    <p class="remove-friend-text">
                        <strong>${username}</strong> adlı kullanıcıyı arkadaşlıktan çıkarmak istediğinize emin misiniz?
                    </p>
                </div>
                <p class="modal-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    Bu işlem geri alınamaz ve yeniden arkadaş olmak için tekrar istek göndermeniz gerekecektir.
                </p>
                <div class="modal-actions">
                    <button class="cancel-button">İptal</button>
                    <button class="confirm-button danger">Arkadaşlıktan Çıkar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);

    // Modalı göster
    showModal(confirmModal);

    // Kapatma butonuna event listener ekle
    const closeBtn = confirmModal.querySelector('.close-modal-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            hideModal(confirmModal);
        });
    }

    // İptal butonuna event listener ekle
    const cancelBtn = confirmModal.querySelector('.cancel-button');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            hideModal(confirmModal);
        });
    }

    // Onay butonuna event listener ekle
    const confirmBtn = confirmModal.querySelector('.confirm-button');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            // Butonu devre dışı bırak
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> İşleniyor...';

            try {
                await removeFriend(userId, username);

                // İşlem başarılı mesajı göster
                const modalContent = confirmModal.querySelector('.modal-content');
                modalContent.innerHTML = `
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <p><strong>${username}</strong> arkadaşlarınızdan çıkarıldı.</p>
                    </div>
                `;

                // 2 saniye sonra modalı kapat
                setTimeout(() => {
                    hideModal(confirmModal);

                    // UI'dan arkadaşı kaldır
                    removeFriendFromUI(userId);
                }, 2000);
            } catch (error) {
                console.error('Arkadaşlık silinirken hata:', error);

                // Hata mesajı göster
                const modalContent = confirmModal.querySelector('.modal-content');
                modalContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Arkadaşlıktan çıkarma işlemi sırasında bir hata oluştu:</p>
                        <p class="error-details">${error.message || 'Bilinmeyen hata'}</p>
                    </div>
                    <div class="modal-actions">
                        <button class="close-button">Kapat</button>
                    </div>
                `;

                // Kapat butonuna event listener ekle
                const closeButton = modalContent.querySelector('.close-button');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        hideModal(confirmModal);
                    });
                }
            }
        });
    }

    // Modal dışına tıklayınca kapat
    confirmModal.addEventListener('click', (event) => {
        if (event.target === confirmModal) {
            hideModal(confirmModal);
        }
    });
}

// Arkadaşlığı veritabanından silme
async function removeFriend(userId, username) {
    if (!currentUserId || !userId) {
        throw new Error('Kullanıcı bilgileri eksik');
    }

    try {
        console.log('Arkadaşlıktan çıkarma işlemi başlatılıyor:', currentUserId, userId);

        // Arkadaşlık kaydını bul - Düzeltilmiş sorgu sözdizimi
        const { data: friendship, error: findError } = await supabase
            .from('friendships')
            .select('id')
            .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${userId}),and(user_id_1.eq.${userId},user_id_2.eq.${currentUserId})`)
            .eq('status', 'accepted');

        console.log('Arkadaşlık sorgu sonucu:', friendship);

        if (findError) {
            throw new Error(`Arkadaşlık kaydı aranırken hata: ${findError.message}`);
        }

        if (!friendship || friendship.length === 0) {
            throw new Error(`'${username}' ile arkadaşlık kaydı bulunamadı.`);
        }

        // Birden fazla kayıt gelebilir, ilkini kullan
        const friendshipRecord = Array.isArray(friendship) ? friendship[0] : friendship;
        console.log('Silinecek arkadaşlık kaydı:', friendshipRecord);

        // Arkadaşlık kaydını sil
        const { error: deleteError } = await supabase
            .from('friendships')
            .delete()
            .eq('id', friendshipRecord.id);

        if (deleteError) {
            throw new Error(`Arkadaşlık silinirken hata: ${deleteError.message}`);
        }

        console.log(`Arkadaşlık silindi: ${friendshipRecord.id} (${username})`);
        return true;
    } catch (error) {
        console.error('removeFriend fonksiyonunda hata:', error);
        throw error;
    }
}

// UI'dan arkadaşı kaldırma
function removeFriendFromUI(userId) {
    // Arkadaş satırını bul ve kaldır
    const friendRow = document.querySelector(`.friend-row[data-user-id="${userId}"]`);
    if (friendRow) {
        friendRow.classList.add('fade-out');
        setTimeout(() => {
            friendRow.remove();
            updateFriendCounters(); // Sayaçları güncelle
        }, 500);
    }

    // DM listesinden de kaldır
    const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
    if (dmItem) {
        dmItem.classList.add('fade-out');
        setTimeout(() => {
            dmItem.remove();
        }, 500);
    }
}

// GIF picker'ı kuran fonksiyon
function setupGifPicker(gifButton, textareaElement) {
    console.log('GIF seçici kurulumu başladı', gifButton);

    // GIF picker modal elementi oluştur
    let gifPickerModal = document.getElementById('gifPickerModal');

    // GIF picker modal yoksa oluştur
    if (!gifPickerModal) {
        gifPickerModal = document.createElement('div');
        gifPickerModal.id = 'gifPickerModal';
        gifPickerModal.className = 'modal-overlay';
        gifPickerModal.style.display = 'none';

        gifPickerModal.innerHTML = `
            <div class="modal-container gif-picker-container">
                <div class="modal-header">
                    <h3>GIF Seçin</h3>
                    <button class="close-modal-btn" title="Kapat">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-content">
                    <div class="gif-search-container">
                        <input type="text" class="gif-search-input" placeholder="GIF ara...">
                        <button class="gif-search-btn"><i class="fas fa-search"></i></button>
                    </div>
                    <div class="gif-results-container">
                        <div class="gif-trending">
                            <div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> GIF'ler yükleniyor...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(gifPickerModal);

        // GIF arama girdisini al
        const gifSearchInput = gifPickerModal.querySelector('.gif-search-input');
        const gifSearchButton = gifPickerModal.querySelector('.gif-search-btn');
        const gifResultsContainer = gifPickerModal.querySelector('.gif-results-container');
        const closeModalButton = gifPickerModal.querySelector('.close-modal-btn');

        // Kapatma düğmesine tıklandığında modalı kapat
        closeModalButton.addEventListener('click', () => {
            hideModal(gifPickerModal);
        });

        // Modal dışına tıklandığında modalı kapat
        gifPickerModal.addEventListener('click', (event) => {
            if (event.target === gifPickerModal) {
                hideModal(gifPickerModal);
            }
        });

        // GIF arama butonuna tıklandığında
        gifSearchButton.addEventListener('click', () => {
            const searchTerm = gifSearchInput.value.trim();
            if (searchTerm) {
                searchGifs(searchTerm, gifResultsContainer);
            }
        });

        // Enter tuşuna basıldığında
        gifSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const searchTerm = gifSearchInput.value.trim();
                if (searchTerm) {
                    searchGifs(searchTerm, gifResultsContainer);
                }
            }
        });

        // Sayfa yüklendiğinde trend GIF'leri göster
        loadTrendingGifs(gifResultsContainer);
    }

    // GIF butonuna tıklama olayı ekle
    const existingClickHandler = gifButton.onclick;

    // Butonun mevcut davranışını koru ama GIF modalını da aç
    gifButton.onclick = function (e) {
        console.log('GIF butonu tıklandı!');
        e.preventDefault(); // Formun gönderilmesini engelle
        e.stopPropagation(); // Diğer event listener'ları durdur

        // GIF modalını göster
        showModal(gifPickerModal);

        // Orijinal işlevi çağırma (eğer varsa ve istersen)
        // if (existingClickHandler) existingClickHandler.call(this, e);

        return false; // Event'i durdur
    };
}

// Trend GIF'leri yükle
async function loadTrendingGifs(container) {
    try {
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Trend GIF\'ler yükleniyor...</div>';

        const response = await fetch(`https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20&client_key=chatlify_web`);
        const data = await response.json();

        displayGifs(data.results, container);
    } catch (error) {
        console.error('Trend GIF\'ler yüklenirken hata:', error);
        container.innerHTML = '<div class="error-placeholder">GIF\'ler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</div>';
    }
}

// GIF arama
async function searchGifs(searchTerm, container) {
    try {
        container.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> GIF\'ler aranıyor...</div>';

        const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchTerm)}&key=${TENOR_API_KEY}&limit=20&client_key=chatlify_web`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displayGifs(data.results, container);
        } else {
            container.innerHTML = `<div class="empty-placeholder">\"${searchTerm}\" ile ilgili GIF bulunamadı.</div>`;
        }
    } catch (error) {
        console.error('GIF\'ler aranırken hata:', error);
        container.innerHTML = '<div class="error-placeholder">GIF\'ler aranırken bir hata oluştu. Lütfen tekrar deneyin.</div>';
    }
}

// GIF'leri görüntüle
function displayGifs(gifs, container) {
    if (!gifs || gifs.length === 0) {
        container.innerHTML = '<div class="empty-placeholder">Hiç GIF bulunamadı.</div>';
        return;
    }

    // Container'ı temizle
    container.innerHTML = '';

    // GIF grid oluştur
    const gifGrid = document.createElement('div');
    gifGrid.className = 'gif-grid';

    // Her GIF için
    gifs.forEach(gif => {
        const gifItem = document.createElement('div');
        gifItem.className = 'gif-item';

        // Ön izleme (preview) görüntüsünü kullan - daha küçük boyutlu
        const previewUrl = gif.media_formats.tinygif.url || gif.media_formats.gif.url;
        const originalUrl = gif.media_formats.gif.url;

        gifItem.innerHTML = `<img src="${previewUrl}" alt="${gif.content_description || 'GIF'}" loading="lazy">`;

        // GIF'e tıklandığında mesaj olarak gönder
        gifItem.addEventListener('click', () => {
            sendGifMessage(originalUrl);
            // Modal'ı kapat
            const gifModal = document.getElementById('gifPickerModal');
            if (gifModal) {
                hideModal(gifModal);
            }
        });

        gifGrid.appendChild(gifItem);
    });

    container.appendChild(gifGrid);
}

// GIF mesajı gönder
async function sendGifMessage(gifUrl) {
    if (!currentConversationId) {
        console.warn('GIF göndermek için geçerli bir sohbet ID\'si gerekli.');
        alert('Aktif bir sohbet bulunamadı. Lütfen önce bir kişi seçin.');
        return;
    }

    if (!currentUserId) {
        console.error('GIF göndermek için oturum açmanız gerekiyor.');
        alert('Oturum bilgileriniz eksik. Lütfen sayfayı yenileyip tekrar deneyin.');
        return;
    }

    try {
        console.log(`GIF gönderiliyor: ${gifUrl}`);
        console.log(`Sohbet ID: ${currentConversationId}, Gönderen ID: ${currentUserId}`);

        // Veritabanında conversationId'nin geçerli olup olmadığını kontrol et
        const { data: convExists, error: convError } = await supabase
            .from('conversations')
            .select('id')
            .eq('id', currentConversationId)
            .maybeSingle();

        if (convError || !convExists) { /* ... error handling ... */
            console.error('Sohbet kontrolünde hata veya sohbet bulunamadı:', convError);
            alert('Sohbet kontrolü sırasında bir hata oluştu veya sohbet bulunamadı.');
            return;
        }

        // GIF mesajı oluştur (JSON formatında)
        const gifMessageContent = JSON.stringify({
            type: 'gif',
            url: gifUrl
        });
        const gifMessage = {
            content: gifMessageContent,
            senderId: currentUserId,
            conversationId: currentConversationId
        };
        console.log('GIF Mesaj verisi:', gifMessage);

        // Mesajı veritabanına ekle
        const { data, error } = await supabase
            .from('messages')
            .insert([gifMessage])
            .select();

        if (error) {
            // ... (existing error handling) ...
            console.error('GIF mesajı gönderilirken hata:', JSON.stringify(error));
            alert('GIF gönderilemedi. Hata: ' + (error.message || 'Bilinmeyen hata'));
            fallbackDisplayGif(gifUrl);
            return;
        }

        // Başarıyla gönderildiyse ekranda göster (displayMessage kullanarak)
        if (data && data.length > 0) {
            console.log('GIF mesajı başarıyla gönderildi:', data[0]);
            displayMessage(data[0]); // displayGifMessage yerine displayMessage çağır
        } else {
            console.warn('GIF mesajı gönderildi ancak veri dönmedi.');
            fallbackDisplayGif(gifUrl);
        }
    } catch (error) {
        // ... (existing error handling) ...
        console.error('GIF gönderilirken hata:', error ? JSON.stringify(error) : 'Bilinmeyen hata');
        alert('GIF gönderilirken bir hata oluştu: ' + (error && error.message ? error.message : 'Bilinmeyen hata'));
        fallbackDisplayGif(gifUrl);
    }
}

// Yedek çözüm: GIF'i doğrudan ekranda göster (veritabanına kaydetmeden)
function fallbackDisplayGif(gifUrl) {
    console.log('🎬 Yedek GIF gösterme fonksiyonu çalıştırılıyor:', gifUrl);

    if (!gifUrl) {
        console.error('❌ fallbackDisplayGif: GIF URL\'i geçersiz.');
        return;
    }

    const chatMessagesContainer = document.querySelector('.chat-panel .chat-messages');
    if (!chatMessagesContainer) {
        console.error('❌ Sohbet mesajları konteyneri bulunamadı.');
        return;
    }

    try {
        // Kendi avatarımızı al
        let displayAvatar = defaultAvatar;
        const userAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');
        if (userAvatarElement) {
            displayAvatar = userAvatarElement.src;
        }

        // JSON formatında gifUrl olabilir - kontrol et
        let finalGifUrl = gifUrl;
        try {
            const contentData = JSON.parse(gifUrl);
            if (contentData && (contentData.type === 'gif' || contentData.messageType === 'gif') && contentData.url) {
                console.log('🎯 GIF JSON formatı algılandı:', contentData);
                finalGifUrl = contentData.url;
            } else if (contentData && contentData.media && contentData.media.url) {
                console.log('🎯 Yeni JSON format algılandı:', contentData);
                finalGifUrl = contentData.media.url;
            }
        } catch (e) {
            // JSON parse hatası - doğrudan URL olarak kullan
            console.log('ℹ️ JSON parse edilemedi, doğrudan URL kullanılıyor');
        }

        // GIF mesaj öğesini oluştur
        const messageElement = document.createElement('div');
        messageElement.className = 'message-group own-message';
        messageElement.setAttribute('data-sender-id', currentUserId || 'local-user');
        messageElement.setAttribute('data-local-message', 'true'); // Yerel olarak oluşturulmuş bir mesaj olduğunu belirt

        // HTML şablonu oluştur
        messageElement.innerHTML = `
            <div class="message-group-avatar">
                <img src="${displayAvatar}" alt="Sen" onerror="this.src='${defaultAvatar}'">
        </div>
            <div class="message-group-content">
                <div class="message-group-header">
                    <span class="message-author">Sen</span>
                    <span class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="message-content gif-message">
                    <img src="${finalGifUrl}" alt="GIF" class="message-gif" loading="lazy">
                </div>
            </div>
        `;

        // Mesaj öğesini chat konteynırına ekle
        chatMessagesContainer.appendChild(messageElement);

        // Sohbetin en altına kaydır
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

        console.log('✅ GIF yerel olarak başarıyla gösterildi. URL:', finalGifUrl);
    } catch (error) {
        console.error('❌ Yedek GIF gösterme başarısız:', error);
        alert('GIF gösterilirken bir hata oluştu.');
    }
}

// displayGifMessage fonksiyonu artık kullanılmıyor, kaldırılabilir veya yorum satırı yapılabilir.
/*
function displayGifMessage(message) {
    // Bu fonksiyonun içeriği artık displayMessage içinde
}
*/

// Profil görüntüleme işlevi
async function openProfilePanel(userId, username, avatar) {
    console.log(`Profil paneli açılıyor: ${username} (${userId})`);

    // Profile panel elementlerini al
    const profilePanel = document.querySelector('.profile-panel');
    const profileContent = profilePanel?.querySelector('.profile-panel-content');

    // Profil paneli yoksa erken çık
    if (!profilePanel || !profileContent) {
        console.error('Profil paneli elementleri bulunamadı');
        return;
    }

    // Profil panelini temizle ve yeni içeriği oluştur
    if (!profileContent.querySelector('.profile-left-section')) {
        profileContent.innerHTML = `
            <button class="profile-close-btn">
            <i class="fas fa-times"></i>
            </button>
            
            <div class="profile-left-section">
                <div class="profile-cover"></div>
                <div class="profile-overlay"></div>
                <div class="profile-left-content">
                    <div class="profile-avatar-large">
                        <img src="${avatar || defaultAvatar}" alt="${username}" onerror="this.src='${defaultAvatar}'">
                        <div class="profile-status-indicator ${onlineFriends && onlineFriends.has(userId) ? 'online' : 'offline'}"></div>
                    </div>
                    <h2 class="profile-username">${username}</h2>
                    <div class="profile-discord-tag">@${username.toLowerCase().replace(/\s+/g, '')}</div>
                    <div class="profile-status-text">
                        <i class="fas fa-circle ${onlineFriends && onlineFriends.has(userId) ? 'online' : 'offline'}"></i>
                        ${onlineFriends && onlineFriends.has(userId) ? 'Çevrimiçi' : 'Çevrimdışı'}
                    </div>
                </div>
            </div>
            
            <div class="profile-right-section">
                <div class="profile-tabs">
                    <div class="profile-tab active" data-tab="user-info">Kullanıcı Bilgileri</div>
                    <div class="profile-tab" data-tab="mutual-servers">Ortak Sunucular</div>
                    <div class="profile-tab" data-tab="mutual-friends">Ortak Arkadaşlar</div>
                </div>
                
                <div class="profile-section active" id="user-info-section">
                    <div class="profile-section-header">
                        <i class="fas fa-info-circle"></i>
                        <h3 class="profile-section-title">Kullanıcı Bilgileri</h3>
                    </div>
                    
                    <div class="profile-info-grid">
                        <div class="profile-info-item">
                            <div class="profile-info-label">
                                <i class="fas fa-calendar-alt"></i>
                                Katılma Tarihi
                            </div>
                            <div class="profile-info-value">Yükleniyor...</div>
                        </div>
                        
                        <div class="profile-info-item">
                            <div class="profile-info-label">
                                <i class="fas fa-award"></i>
                                Rozetler
                            </div>
                            <div class="profile-badges-container">
                                <div class="profile-badge">
                                    <i class="fas fa-user-alt"></i>
                                    <span>Yeni Üye</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-note-container">
                        <textarea class="profile-note-textarea" placeholder="Bu kullanıcı hakkında kişisel not ekle..."></textarea>
                    </div>
                    
                    <div class="profile-action-buttons">
                        <button class="profile-action-btn message-btn">
                            <i class="fas fa-comment"></i>
                            Mesaj Gönder
                        </button>
                        
                        <button class="profile-action-btn block-btn">
                            <i class="fas fa-ban"></i>
                            Engelle
                        </button>
                        
                        <button class="profile-action-btn remove-btn">
                            <i class="fas fa-user-times"></i>
                            Arkadaşlıktan Çıkar
                        </button>
                    </div>
                </div>
                
                <div class="profile-section" id="mutual-servers-section">
                    <div class="profile-section-header">
                        <i class="fas fa-server"></i>
                        <h3 class="profile-section-title">Ortak Sunucular</h3>
                    </div>
                    <div class="profile-info-value">Henüz ortak sunucu bulunmamaktadır.</div>
                </div>
                
                <div class="profile-section" id="mutual-friends-section">
                    <div class="profile-section-header">
                        <i class="fas fa-users"></i>
                        <h3 class="profile-section-title">Ortak Arkadaşlar</h3>
                    </div>
                    <div class="profile-info-value">Henüz ortak arkadaş bulunmamaktadır.</div>
                </div>
        </div>
    `;

        // Profil sekmeleri için event listener'ları ekle
        setupProfileTabControls(profileContent);
    } else {
        // Eğer panel zaten oluşturulmuşsa, sadece içeriği güncelle
        const profileUsernameElement = profileContent.querySelector('.profile-username');
        const profileAvatarElement = profileContent.querySelector('.profile-avatar-large img');
        const profileStatusIndicator = profileContent.querySelector('.profile-status-indicator');
        const profileStatusText = profileContent.querySelector('.profile-status-text');

        if (profileUsernameElement) profileUsernameElement.textContent = username;
        if (profileAvatarElement) {
            profileAvatarElement.src = avatar || defaultAvatar;
            profileAvatarElement.onerror = () => {
                profileAvatarElement.src = defaultAvatar;
            };
        }

        // Çevrimiçi durumu güncelle
        const isOnline = onlineFriends && onlineFriends.has(userId);
        if (profileStatusIndicator) {
            profileStatusIndicator.className = `profile-status-indicator ${isOnline ? 'online' : 'offline'}`;
        }
        if (profileStatusText) {
            profileStatusText.innerHTML = `
                <i class="fas fa-circle ${isOnline ? 'online' : 'offline'}"></i>
                ${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
            `;
        }
    }

    // Kullanıcı bilgilerini güncelle (gerektiğinde API'den yükle)
    try {
        console.log(`Profil bilgileri yükleniyor: ${userId}`);

        // Katılma tarihini API'den al - sadece createdAt sütununu sorguluyoruz
        const { data: userData, error } = await supabase
            .from('users')
            .select('createdAt') // Sadece createdAt sütununu sorgula
            .eq('id', userId)
            .maybeSingle();

        console.log('Supabase yanıtı:', userData, error);

        if (error) {
            console.error('Kullanıcı bilgileri alınırken hata:', error);
            return;
        }

        if (userData) {
            const joinDateElement = profileContent.querySelector('#user-info-section .profile-info-item:nth-child(1) .profile-info-value');
            console.log('DOM Element bulundu:', joinDateElement, 'createdAt değeri:', userData.createdAt);

            if (joinDateElement && userData.createdAt) {
                const joinDate = new Date(userData.createdAt);
                console.log('Tarih nesnesi oluşturuldu:', joinDate);

                joinDateElement.textContent = joinDate.toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
                console.log('Tarih metni ayarlandı:', joinDateElement.textContent);
            } else {
                // Fallback olarak geçici tarih göster
                if (joinDateElement) {
                    joinDateElement.textContent = "Bilinmiyor";
                    console.log('Tarih bilgisi bulunamadı, varsayılan değer kullanılıyor');
                }
            }

            // Rozetler kısmını ekleyecek kod buraya gelecek (İleri aşamalarda implement edilecek)
            // Şimdilik sadece "Yeni Üye" rozetini gösteriyoruz
        } else {
            console.warn(`${userId} için kullanıcı verisi bulunamadı`);
            const joinDateElement = profileContent.querySelector('#user-info-section .profile-info-item:nth-child(1) .profile-info-value');
            if (joinDateElement) {
                joinDateElement.textContent = "Bilinmiyor";
            }
        }
    } catch (error) {
        console.error('Kullanıcı bilgileri yüklenirken hata:', error);
        const joinDateElement = profileContent.querySelector('#user-info-section .profile-info-item:nth-child(1) .profile-info-value');
        if (joinDateElement) {
            joinDateElement.textContent = "Bilinmiyor";
        }
    }

    // Profil panelinin kapatma butonuna tıklama eventi ekle
    const closeBtn = profileContent.querySelector('.profile-close-btn');
    if (closeBtn) {
        // Eski event listener'ları temizle
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Yeni event listener ekle
        newCloseBtn.addEventListener('click', () => {
            closeProfilePanel();
        });
    }

    // Mesaj gönder butonuna tıklama eventi ekle
    const messageBtn = profileContent.querySelector('.profile-action-btn.message-btn');
    if (messageBtn) {
        // Eski event listener'ları temizle
        const newMessageBtn = messageBtn.cloneNode(true);
        messageBtn.parentNode.replaceChild(newMessageBtn, messageBtn);

        // Yeni event listener ekle
        newMessageBtn.addEventListener('click', () => {
            closeProfilePanel();
            openChatPanel(userId, username, avatar);
        });
    }

    // Arkadaşlıktan çıkar butonuna tıklama eventi ekle
    const removeBtn = profileContent.querySelector('.profile-action-btn.remove-btn');
    if (removeBtn) {
        // Eski event listener'ları temizle
        const newRemoveBtn = removeBtn.cloneNode(true);
        removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);

        // Yeni event listener ekle
        newRemoveBtn.addEventListener('click', () => {
            closeProfilePanel();
            showRemoveFriendConfirmation(userId, username, avatar);
        });
    }

    // Click dışındaki alana tıklandığında profil panelini kapat
    profilePanel.addEventListener('click', (e) => {
        if (e.target === profilePanel) {
            closeProfilePanel();
        }
    });

    // Profil panelini göster
    profilePanel.classList.add('show');

    // ESC tuşuna basıldığında profil panelini kapat
    const handleEscKey = (e) => {
        if (e.key === 'Escape') {
            closeProfilePanel();
            document.removeEventListener('keydown', handleEscKey);
        }
    };
    document.addEventListener('keydown', handleEscKey);
}

// Profil panelini kapatma
function closeProfilePanel() {
    const profilePanel = document.querySelector('.profile-panel');
    if (profilePanel) {
        profilePanel.classList.remove('show');
    }
}

// Profil paneli sekme kontrollerini ayarla
function setupProfileTabControls(profileContent) {
    const tabs = profileContent.querySelectorAll('.profile-tab');
    const sections = profileContent.querySelectorAll('.profile-section');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Aktif sekmeyi değiştir
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // İlgili içerik bölümünü göster
            const targetTab = tab.dataset.tab;
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === `${targetTab}-section`) {
                    section.classList.add('active');
                }
            });
        });
    });
}

// Uygulamanın başlatıldığı ana fonksiyon (DOMContentLoaded'da çağrılıyor)
document.addEventListener('DOMContentLoaded', function () {
    // ... existing code ...

    // Sohbet panelindeki profil butonuna tıklanınca profil panelini açma
    const chatHeaderProfileBtn = document.querySelector('.chat-panel .chat-header .profile-btn');
    if (chatHeaderProfileBtn) {
        chatHeaderProfileBtn.addEventListener('click', function () {
            // Aktif sohbet kullanıcısının bilgilerini al
            const userId = currentConversationId; // DM sisteminde conversationId genellikle karşı kullanıcının ID'si

            // Chat header'dan kullanıcı bilgilerini al
            const chatHeader = document.querySelector('.chat-panel .chat-header');
            const username = chatHeader?.querySelector('.chat-username')?.textContent || 'Kullanıcı';
            const avatarImg = chatHeader?.querySelector('.chat-avatar img');
            const avatar = avatarImg ? avatarImg.src : defaultAvatar;

            // Profil panelini aç
            openProfilePanel(userId, username, avatar);
        });
    }

    // ... existing code ...
});
