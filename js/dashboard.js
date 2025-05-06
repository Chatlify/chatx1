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

        // Emoji butonu seçimi güncellendi - .emoji-btn ile arama kaldırıldı
        const chatEmojiBtn = document.querySelector('.chat-input-area .chat-attachment-btn:nth-child(2)');
        if (chatEmojiBtn) {
            // Emoji butonu bulunduğunda, içeriğini ve sınıfını güncelle
            chatEmojiBtn.title = "Emoji ekle";
            chatEmojiBtn.classList.add('emoji-btn');
            chatEmojiBtn.innerHTML = '<i class="fas fa-smile"></i>';
            console.log('Emoji butonu güncellendi ve hazır:', chatEmojiBtn);
        } else {
            console.warn('Emoji butonu bulunamadı, chat-attachment-btn olarak aranacak...');
        }

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

        // Emoji picker dinleyicisini kur - chatEmojiBtn kullanımı değiştirildi
        if (chatEmojiBtn && chatTextarea) {
            console.log('Emoji picker hazırlanıyor...');
            setupEmojiPicker(chatEmojiBtn, chatTextarea, emojiPicker);
        } else {
            console.warn('Emoji picker kurulumu için gerekli elementler eksik:',
                { chatEmojiBtn: !!chatEmojiBtn, chatTextarea: !!chatTextarea });
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
            tab.addEventListener('click', (event) => { // Değişiklik: (event) parametresi eklendi
                // Tüm sekmeleri sıfırla
                tabs.forEach(t => t.classList.remove('active'));

                // Tıklanan sekmeyi aktif yap
                tab.classList.add('active');

                // İçeriği göster/gizle
                const tabName = tab.textContent.trim();
                showSection(tabName, tabContents);

                // Eğer "Bekleyen" sekmesiyse, bekleyen istekleri yükle.
                // Bu hem kullanıcı tıklamasında (ilk etki) hem de sentetik tıklamada (ikinci etki) çalışır.
                if (tabName === 'Bekleyen') {
                    loadPendingFriendRequests();
                }

                // Sadece kullanıcı tarafından yapılan gerçek bir tıklama ise
                // ve sekme "Bekleyen" ise, ikinci (sentetik) tıklamayı simüle et.
                if (tabName === 'Bekleyen' && event.isTrusted) { // Değişiklik: event.isTrusted kontrolü eklendi
                    setTimeout(() => {
                        const syntheticClickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                            // Bu olay için event.isTrusted false olacaktır
                        });
                        // Bu sentetik tıklama, bu event listener'ı tekrar çalıştıracak.
                        // Ancak event.isTrusted false olacağı için, bu if bloğuna (setTimeout bloğu)
                        // tekrar girilmeyecek ve sonsuz döngü önlenecek.
                        tab.dispatchEvent(syntheticClickEvent);
                    }, 10); // Çok kısa bir gecikme ile ikinci tıklamayı tetikle
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
                    <div class="friend-actions">
                        <button class="friend-action-btn message-btn" title="Mesaj Gönder">
                            <i class="fas fa-comment"></i>
                        </button>
                    </div>
                `;

        // Mesaj gönder butonuna tıklama olayı ekle
        const messageBtn = friendElement.querySelector('.message-btn');
        if (messageBtn) {
            messageBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Event'in ana elemana geçmesini engelle
                openChatPanel(userId, username, avatar);
            });
        }

        // Tüm satıra tıklanınca da sohbet panelini aç
        friendElement.addEventListener('click', () => {
            openChatPanel(userId, username, avatar);
        });

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

    // Sunucu Ekle butonu için modal gösterimi ekle
    const addServerButton = document.querySelector('.server-add-icon');
    const serverModal = document.getElementById('server-modal');

    if (addServerButton && serverModal) {
        addServerButton.addEventListener('click', function (e) {
            e.preventDefault();
            showModal(serverModal);
        });

        // Modal kapatma butonları için dinleyiciler
        const closeServerModalBtn = serverModal.querySelector('.close-server-modal-btn');
        if (closeServerModalBtn) {
            closeServerModalBtn.addEventListener('click', () => {
                hideModal(serverModal);
            });
        }

        // Modal dışına tıklama ile kapatma
        serverModal.addEventListener('click', (event) => {
            if (event.target === serverModal) {
                hideModal(serverModal);
            }
        });

        // Sunucu oluşturma ve katılma seçenekleri
        const createServerOption = document.getElementById('server-option-create');
        const joinServerOption = document.getElementById('server-option-join');
        const createServerForm = document.getElementById('server-create-form');
        const joinServerForm = document.getElementById('server-join-form');
        const backButtons = serverModal.querySelectorAll('.back-to-options-btn');

        if (createServerOption && joinServerOption && createServerForm && joinServerForm) {
            // Sunucu oluştur seçeneğine tıklanınca
            createServerOption.addEventListener('click', () => {
                document.querySelector('.server-options-container').style.display = 'none';
                createServerForm.style.display = 'block';
            });

            // Sunucuya katıl seçeneğine tıklanınca
            joinServerOption.addEventListener('click', () => {
                document.querySelector('.server-options-container').style.display = 'none';
                joinServerForm.style.display = 'block';
            });

            // Geri butonları için olay dinleyicileri
            backButtons.forEach(button => {
                button.addEventListener('click', () => {
                    createServerForm.style.display = 'none';
                    joinServerForm.style.display = 'none';
                    document.querySelector('.server-options-container').style.display = 'block';
                });
            });
        }
    } else {
        console.warn('Sunucu Ekle buton veya modal elementleri bulunamadı:', {
            addServerButton: !addServerButton,
            serverModal: !serverModal
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
    const dashboardContainer = document.querySelector('.dashboard-container');

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

    // Dashboard container'a chat-open sınıfını ekle - geniş mod için
    if (dashboardContainer) {
        dashboardContainer.classList.add('chat-open');
    }

    // Aktif sohbetin user ID'sini panele ekle (durum güncellemesi için)
    chatPanel.dataset.activeChatUserId = userId;

    // Header butonlarının işlevselliğini ayarla
    setupChatHeaderActions(userId, username, avatar);

    // Mesajları GERÇEK sohbet ID'si ile yükle
    loadConversationMessages(currentConversationId);

    // Realtime aboneliği GERÇEK sohbet ID'si ile başlat
    subscribeToMessages(currentConversationId);
}

// Sohbet panelini kapatma
function closeChatPanel() {
    const chatPanel = document.querySelector('.chat-panel');
    const friendsPanelContainer = document.querySelector('.friends-panel-container');
    const sponsorSidebar = document.querySelector('.sponsor-sidebar');
    const dashboardContainer = document.querySelector('.dashboard-container');

    if (!chatPanel || !friendsPanelContainer) return;

    // Paneli gizle
    chatPanel.classList.add('hidden');
    friendsPanelContainer.classList.remove('hidden');

    // Sponsor sidebar'ı göster (eğer varsa)
    if (sponsorSidebar) sponsorSidebar.style.display = '';

    // Dashboard container'dan chat-open sınıfını kaldır
    if (dashboardContainer) {
        dashboardContainer.classList.remove('chat-open');
    }

    // Aktif DM stilini kaldır
    document.querySelectorAll('.dm-item.active').forEach(item => item.classList.remove('active'));

    // Aktif sohbet ID'sini temizle
    currentConversationId = null;

    // Realtime aboneliğini sonlandır
    unsubscribeFromMessages();
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

// Eski emoji picker'ı kuran fonksiyon (kaldırılacak)
function setupEmojiPicker(emojiButton, textareaElement, emojiPickerElement) {
    console.log('🔄 Emoji sistemi başlatılıyor...', emojiButton);

    // Mevcut emoji panelini temizle
    const oldPanel = document.getElementById('emoji-panel');
    if (oldPanel) {
        oldPanel.remove();
    }

    // Emoji kategorileri ve emojileri
    const emojiCategories = [
        {
            name: 'Yüzler',
            icon: 'fa-face-smile',
            emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🤔', '🫡', '🤗', '🫢', '🤭', '🫠', '🥴', '🤢']
        },
        {
            name: 'Eller',
            icon: 'fa-hand',
            emojis: ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👅', '👄', '🫦']
        },
        {
            name: 'Hayvanlar',
            icon: 'fa-paw',
            emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🪿', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀']
        },
        {
            name: 'Yiyecek',
            icon: 'fa-utensils',
            emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪']
        },
        {
            name: 'Etkinlik',
            icon: 'fa-cake-candles',
            emojis: ['🎉', '🎊', '🎈', '🎂', '🎀', '🎁', '🎄', '🎃', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉', '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎮', '🎰', '🎲', '🧩', '🎭', '🎨', '🧵', '🪡', '🧶', '🪢']
        },
        {
            name: 'Seyahat',
            icon: 'fa-car',
            emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🚏', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️']
        },
        {
            name: 'Semboller',
            icon: 'fa-icons',
            emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔']
        },
        {
            name: 'Bayraklar',
            icon: 'fa-flag',
            emojis: ['🇹🇷', '🇦🇿', '🇩🇪', '🇬🇧', '🇺🇸', '🇯🇵', '🇰🇷', '🇷🇺', '🇨🇳', '🇧🇷', '🇮🇳', '🇵🇰', '🇫🇷', '🇪🇸', '🇮🇹', '🇵🇹', '🇳🇱', '🇧🇪', '🇬🇷', '🇨🇭', '🇸🇪', '🇩🇰', '🇳🇴', '🇫🇮', '🇦🇹', '🇮🇪', '🇨🇿', '🇵🇱', '🇭🇺', '🇺🇦', '🇧🇬', '🇷🇴', '🇦🇺', '🇨🇦', '🇲🇽', '🇸🇦', '🇦🇪', '🇶🇦', '🇰🇼', '🇮🇷', '🇮🇶', '🇪🇬', '🇿🇦', '🇳🇬', '🇯🇴', '🇱🇧', '🇸🇾', '🇮🇱', '🇩🇿', '🇱🇾', '🇹🇳', '🇲🇦', '🇸🇳', '🇨🇮', '🇬🇭', '🇨🇲', '🇰🇪', '🇪🇹']
        }
    ];

    // Ana emoji panel elementini oluştur - Sağda açılacak şekilde yenilenmiş
    const emojiPanel = document.createElement('div');
    emojiPanel.id = 'emoji-panel';
    emojiPanel.className = 'emoji-panel folded';

    // Panel içeriğini oluştur - Katlanmış kağıt görünümü için yapılandırıldı
    emojiPanel.innerHTML = `
        <div class="emoji-panel-header">
            <div class="emoji-panel-title">Emojiler</div>
            <button class="emoji-panel-close" title="Kapat"><i class="fas fa-times"></i></button>
        </div>
        <div class="emoji-search">
            <input type="text" class="emoji-search-input" placeholder="Emoji ara...">
            <span class="emoji-search-icon"><i class="fas fa-search"></i></span>
        </div>
        <div class="emoji-panel-tabs"></div>
        <div class="emoji-container"></div>
        <div class="emoji-panel-footer">
            <div class="emoji-panel-info">Chatlify Emoji Sistemi</div>
        </div>
    `;

    // Emoji panelini chat panel içine ekle (chat-panel'e doğrudan ekleyerek sağda konumlandır)
    const chatPanel = document.querySelector('.chat-panel');
    if (chatPanel) {
        chatPanel.appendChild(emojiPanel);
        console.log('Emoji paneli sohbet paneline eklendi:', chatPanel);
    } else {
        const alternativeContainer = document.querySelector('.dashboard-container');
        if (alternativeContainer) {
            alternativeContainer.appendChild(emojiPanel);
            console.log('Emoji paneli dashboard container\'a eklendi:', alternativeContainer);
        } else {
            document.body.appendChild(emojiPanel);
            console.log('Emoji paneli body\'ye eklendi, uygun container bulunamadı');
        }
    }

    // Emoji tab'larını oluştur
    const tabsContainer = emojiPanel.querySelector('.emoji-panel-tabs');

    emojiCategories.forEach((category, index) => {
        const tab = document.createElement('button');
        tab.className = `emoji-tab ${index === 0 ? 'active' : ''}`;
        tab.dataset.category = category.name;
        tab.innerHTML = `<i class="fas ${category.icon}"></i>`;
        tab.title = category.name;

        tab.addEventListener('click', () => {
            // Aktif tab'ı güncelle
            emojiPanel.querySelectorAll('.emoji-tab').forEach(t => {
                t.classList.remove('active');
            });
            tab.classList.add('active');

            // Emoji container'ı güncelle
            renderEmojis(category);
        });

        tabsContainer.appendChild(tab);
    });

    // İlk kategoriyi göster
    renderEmojis(emojiCategories[0]);

    // Sayfaya emoji paneli için stil ekle
    const emojiStyles = document.createElement('style');
    emojiStyles.id = "emoji-panel-styles";
    emojiStyles.textContent = `
        #emoji-panel {
            position: absolute;
            top: 0;
            right: 0;
            width: 320px;
            height: 100%;
            background-color: var(--main-bg, #36393f);
            border-left: 1px solid var(--divider-color, #42464d);
            z-index: 100;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            transform-origin: right center;
            box-shadow: -4px 0 15px rgba(0, 0, 0, 0.2);
            font-family: 'Poppins', sans-serif;
        }
        
        #emoji-panel.folded {
            transform: translateX(100%);
        }
        
        #emoji-panel.unfolding {
            animation: unfoldPanel 0.4s forwards;
        }
        
        #emoji-panel.folding {
            animation: foldPanel 0.3s forwards;
        }
        
        @keyframes unfoldPanel {
            0% { transform: translateX(100%); }
            100% { transform: translateX(0); }
        }
        
        @keyframes foldPanel {
            0% { transform: translateX(0); }
            100% { transform: translateX(100%); }
        }

        #emoji-panel .emoji-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 16px;
            border-bottom: 1px solid var(--divider-color, #42464d);
            background-color: var(--main-bg-light, #3a3d42);
        }

        #emoji-panel .emoji-panel-title {
            font-weight: 600;
            color: var(--text-color, white);
            font-size: 16px;
        }

        #emoji-panel .emoji-panel-close {
            background: none;
            border: none;
            color: var(--text-secondary, #b9bbbe);
            cursor: pointer;
            font-size: 16px;
            padding: 4px;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }

        #emoji-panel .emoji-panel-close:hover {
            color: var(--text-color, white);
            background-color: rgba(255, 255, 255, 0.1);
        }

        #emoji-panel .emoji-search {
            padding: 12px 16px;
            position: relative;
            border-bottom: 1px solid var(--divider-color, #42464d);
        }

        #emoji-panel .emoji-search-input {
            width: 100%;
            padding: 8px 32px 8px 12px;
            border: 1px solid var(--input-border, #202225);
            background-color: var(--input-bg, #202225);
            color: var(--text-color, white);
            border-radius: 4px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        #emoji-panel .emoji-search-input:focus {
            border-color: var(--primary-color, #7289da);
        }

        #emoji-panel .emoji-search-icon {
            position: absolute;
            right: 25px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted, #72767d);
            pointer-events: none;
        }

        #emoji-panel .emoji-panel-tabs {
            display: flex;
            overflow-x: auto;
            padding: 8px 12px;
            border-bottom: 1px solid var(--divider-color, #42464d);
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, #202225) transparent;
        }

        #emoji-panel .emoji-tab {
            background: none;
            border: none;
            color: var(--text-secondary, #b9bbbe);
            padding: 8px;
            margin: 0 4px;
            cursor: pointer;
            border-radius: 4px;
            flex-shrink: 0;
            transition: all 0.2s;
        }

        #emoji-panel .emoji-tab:hover {
            background-color: rgba(255, 255, 255, 0.06);
            color: var(--text-color, white);
        }
        
        #emoji-panel .emoji-tab.active {
            background-color: var(--primary-color, #7289da);
            color: white;
        }

        #emoji-panel .emoji-container {
            padding: 12px;
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
            overflow-y: auto;
            flex-grow: 1;
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, #202225) transparent;
        }

        #emoji-panel .emoji-category-title {
            grid-column: 1 / -1;
            color: var(--text-secondary, #b9bbbe);
            font-size: 12px;
            margin: 5px 0;
            font-weight: 600;
            padding: 4px 0;
        }

        #emoji-panel .emoji-item {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            height: 40px;
            width: 40px;
            border-radius: 4px;
            transition: background-color 0.15s ease;
        }

        #emoji-panel .emoji-item:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }

        #emoji-panel .emoji-panel-footer {
            padding: 8px 16px;
            border-top: 1px solid var(--divider-color, #42464d);
            color: var(--text-muted, #72767d);
            font-size: 11px;
            text-align: center;
            background-color: var(--main-bg-light, #3a3d42);
        }
        
        /* Scrollbar stili */
        #emoji-panel .emoji-container::-webkit-scrollbar {
            width: 6px;
        }
        
        #emoji-panel .emoji-container::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar-thumb, #202225);
            border-radius: 3px;
        }
        
        #emoji-panel .emoji-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        /* Emoji butonu aktif durumu */
        .emoji-btn.active {
            background-color: var(--primary-color-light, #4e5d94) !important;
            color: white !important;
        }
    `;

    // Önceki stili temizle ve yenisini ekle
    const oldStyle = document.getElementById("emoji-panel-styles");
    if (oldStyle) oldStyle.remove();
    document.head.appendChild(emojiStyles);

    // Emoji paneli göster fonksiyonu - Katlanmış kağıt efektiyle
    function showEmojiPanel() {
        emojiPanel.classList.remove('folded');
        emojiPanel.classList.add('unfolding');
        emojiButton.classList.add('active');

        // Animasyon bittikten sonra unfolding sınıfını kaldır
        setTimeout(() => {
            emojiPanel.classList.remove('unfolding');
        }, 400);

        // İlk sekmeyi aktif et
        const firstTab = emojiPanel.querySelector('.emoji-tab');
        if (firstTab) {
            firstTab.click();
        }

        console.log('📣 Emoji paneli gösteriliyor (sağ tarafta)');
    }

    // Emoji paneli gizle fonksiyonu - Katlama efektiyle
    function hideEmojiPanel() {
        emojiPanel.classList.add('folding');

        setTimeout(() => {
            emojiPanel.classList.remove('folding');
            emojiPanel.classList.add('folded');
            emojiButton.classList.remove('active');
        }, 300);
    }

    // Emoji search işlevselliği
    const searchInput = emojiPanel.querySelector('.emoji-search-input');
    let searchTimeout;

    searchInput.addEventListener('input', () => {
        // Input değişikliğinde gecikme ile ara (performans için)
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const searchTerm = searchInput.value.trim();

            if (searchTerm) {
                renderEmojis(null, searchTerm);
            } else {
                // Boş arama ise aktif kategoriye dön
                const activeTab = emojiPanel.querySelector('.emoji-tab.active');
                const categoryName = activeTab.dataset.category;
                const category = emojiCategories.find(c => c.name === categoryName);

                if (category) {
                    renderEmojis(category);
                } else {
                    renderEmojis(emojiCategories[0]);
                }
            }
        }, 300);
    });

    // Emojileri render et
    function renderEmojis(category, searchTerm = '') {
        const emojiContainer = emojiPanel.querySelector('.emoji-container');
        emojiContainer.innerHTML = '';

        // Eğer arama terimi varsa tüm kategorileri ara
        if (searchTerm) {
            let foundEmojis = [];
            emojiCategories.forEach(cat => {
                const filteredEmojis = cat.emojis.filter(emoji => {
                    // Basit bir arama algoritması
                    // Gerçek uygulamada emoji adları, anahtar kelimeler vs. ile eşleştirme yapılabilir
                    return emoji.includes(searchTerm);
                });

                if (filteredEmojis.length > 0) {
                    foundEmojis.push({
                        name: cat.name,
                        emojis: filteredEmojis
                    });
                }
            });

            if (foundEmojis.length === 0) {
                emojiContainer.innerHTML = '<div class="emoji-category-title">Sonuç bulunamadı</div>';
                return;
            }

            // Bulunan emojileri kategorilere göre göster
            foundEmojis.forEach(result => {
                // Kategori başlığını ekle
                const categoryTitle = document.createElement('div');
                categoryTitle.className = 'emoji-category-title';
                categoryTitle.textContent = result.name;
                emojiContainer.appendChild(categoryTitle);

                // Emojileri ekle
                result.emojis.forEach(emoji => {
                    addEmojiToContainer(emoji, emojiContainer);
                });
            });
        } else if (category) {
            // Normal kategori görünümü
            category.emojis.forEach(emoji => {
                addEmojiToContainer(emoji, emojiContainer);
            });
        }
    }

    // Container'a emoji ekle
    function addEmojiToContainer(emoji, container) {
        const emojiElement = document.createElement('div');
        emojiElement.className = 'emoji-item';
        emojiElement.textContent = emoji;
        emojiElement.title = emoji;

        emojiElement.addEventListener('click', () => {
            insertEmoji(emoji);
            // İsteğe bağlı: Emoji seçildiğinde paneli kapat
            // hideEmojiPanel();
        });

        container.appendChild(emojiElement);
    }

    // Emojiyi metin alanına ekle
    function insertEmoji(emoji) {
        const textarea = textareaElement || getMessageTextarea();
        if (!textarea) {
            console.error('❌ Emoji eklemek için textarea bulunamadı!');
            return;
        }

        try {
            // Emoji ekleme işlemi
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const before = text.substring(0, start);
            const after = text.substring(end, text.length);

            // Emojiyi ekle
            textarea.value = before + emoji + after;

            // İmleci emoji sonrasına taşı
            const newPosition = start + emoji.length;
            textarea.selectionStart = textarea.selectionEnd = newPosition;

            // Değişikliği tetiklemek için input event gönder
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Odaklanmayı garantile
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(newPosition, newPosition);
            }, 10);

            console.log('✅ Emoji başarıyla eklendi:', emoji);
        } catch (error) {
            console.error('❌ Emoji eklenirken hata oluştu:', error);
        }
    }

    // Emoji butonuna tıklama olayı
    emojiButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isVisible = !emojiPanel.classList.contains('folded');

        if (isVisible) {
            hideEmojiPanel();
        } else {
            showEmojiPanel();
        }
    });

    // Kapatma butonuna tıklama olayı
    emojiPanel.querySelector('.emoji-panel-close').addEventListener('click', () => {
        hideEmojiPanel();
    });

    // Dışarı tıklandığında emoji paneli kapat
    document.addEventListener('click', (e) => {
        if (!emojiPanel.classList.contains('folded') &&
            e.target !== emojiButton &&
            !emojiPanel.contains(e.target)) {
            hideEmojiPanel();
        }
    });

    // Yardımcı fonksiyonlar
    function getMessageTextarea() {
        // "Bir mesaj yazın..." placeholder'ı ile ara
        const allTextareas = document.querySelectorAll('textarea');
        for (let textarea of allTextareas) {
            if (textarea.placeholder && (
                textarea.placeholder.includes('mesaj yazın') ||
                textarea.placeholder.includes('Bir mesaj')
            )) {
                return textarea;
            }
        }

        // Aktif sohbet panelinde ara
        const chatPanel = document.querySelector('.chat-panel.active') || document.querySelector('.chat-panel');
        if (chatPanel) {
            const textarea = chatPanel.querySelector('textarea');
            if (textarea) {
                return textarea;
            }
        }

        // Son çare: sayfadaki son textarea
        return document.querySelector('textarea:last-of-type');
    }

    console.log('✅ Sağ tarafta açılan emoji sistemi kurulumu tamamlandı');
    return {
        show: showEmojiPanel,
        hide: hideEmojiPanel,
        insert: insertEmoji
    };
}

// ... existing code ...

// GIF seçici fonksiyonu tanımı
function setupGifPicker(gifButton, textarea) {
    // GIF modal oluşturma
    const gifModalHtml = `
        <div class="gif-picker-modal">
            <div class="gif-picker-header">
                <div class="gif-search-container">
                    <input type="text" class="gif-search-input" placeholder="GIF ara...">
                    <button class="gif-search-button"><i class="fas fa-search"></i></button>
            </div>
                <button class="gif-close-button"><i class="fas fa-times"></i></button>
                </div>
            <div class="gif-categories">
                <button class="gif-category active" data-category="trending">Trend</button>
                <button class="gif-category" data-category="reactions">Tepkiler</button>
                <button class="gif-category" data-category="memes">Meme</button>
                <button class="gif-category" data-category="gaming">Oyun</button>
                <button class="gif-category" data-category="anime">Anime</button>
                </div>
            <div class="gif-results">
                <div class="gif-loading">
                    <div class="spinner"></div>
            </div>
                <div class="gif-grid"></div>
                <div class="gif-error" style="display: none;">
                    GIF yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
        </div>
                    </div>
                    </div>
                `;

    // GIF modal elementini sayfaya ekle
    const gifModalElement = document.createElement('div');
    gifModalElement.innerHTML = gifModalHtml;
    gifModalElement.classList.add('gif-picker-container');
    document.body.appendChild(gifModalElement);

    // Elemanları seç
    const gifModal = document.querySelector('.gif-picker-container');
    const gifSearchInput = document.querySelector('.gif-search-input');
    const gifSearchButton = document.querySelector('.gif-search-button');
    const gifCloseButton = document.querySelector('.gif-close-button');
    const gifCategories = document.querySelectorAll('.gif-category');
    const gifGrid = document.querySelector('.gif-grid');
    const gifLoading = document.querySelector('.gif-loading');
    const gifError = document.querySelector('.gif-error');

    // GIF butonuna tıklama olayı
    gifButton.addEventListener('click', () => {
        showGifModal();
        loadTrendingGifs();
    });

    // GIF arama
    gifSearchButton.addEventListener('click', () => {
        const searchTerm = gifSearchInput.value.trim();
        if (searchTerm) {
            searchGifs(searchTerm);
        }
    });

    // Enter tuşuna basıldığında arama
    gifSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = gifSearchInput.value.trim();
            if (searchTerm) {
                searchGifs(searchTerm);
            }
        }
    });

    // Kategoriye tıklama
    gifCategories.forEach(category => {
        category.addEventListener('click', () => {
            // Aktif kategoriyi güncelle
            gifCategories.forEach(cat => cat.classList.remove('active'));
            category.classList.add('active');

            // Kategori için GIF'leri yükle
            const categoryName = category.getAttribute('data-category');
            if (categoryName === 'trending') {
                loadTrendingGifs();
            } else {
                searchGifs(categoryName);
            }
        });
    });

    // Kapatma düğmesi
    gifCloseButton.addEventListener('click', hideGifModal);

    // GIF modalını göster
    function showGifModal() {
        gifModal.style.display = 'block';
        setTimeout(() => {
            gifModal.classList.add('show');
            // Modal dışına tıklama ile kapatma
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }

    // GIF modalını gizle
    function hideGifModal() {
        gifModal.classList.remove('show');
        setTimeout(() => {
            gifModal.style.display = 'none';
            // Dışarı tıklama olayını kaldır
            document.removeEventListener('click', handleOutsideClick);
        }, 300);
    }

    // Dışarıya tıklama işlemi
    function handleOutsideClick(e) {
        if (gifModal.contains(e.target) || gifButton.contains(e.target)) {
            return;
        }
        hideGifModal();
    }

    // Trend GIF'leri yükle
    async function loadTrendingGifs() {
        showLoadingState();
        try {
            const response = await fetch(`https://tenor.googleapis.com/v2/featured?key=${TENOR_API_KEY}&limit=20`);
            const data = await response.json();
            displayGifs(data.results);
        } catch (error) {
            console.error('Trend GIF yükleme hatası:', error);
            showErrorState();
        }
    }

    // GIF ara
    async function searchGifs(query) {
        showLoadingState();
        try {
            const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`);
            const data = await response.json();
            displayGifs(data.results);
        } catch (error) {
            console.error('GIF arama hatası:', error);
            showErrorState();
        }
    }

    // GIF'leri göster
    function displayGifs(gifs) {
        hideLoadingState();
        hideErrorState();

        if (!gifs || gifs.length === 0) {
            gifGrid.innerHTML = '<div class="no-results">Hiçbir GIF bulunamadı.</div>';
            return;
        }

        gifGrid.innerHTML = '';
        gifs.forEach(gif => {
            const gifItem = document.createElement('div');
            gifItem.classList.add('gif-item');

            // Ana görüntüyü al (tinyGif formatı)
            const gifMedia = gif.media_formats.tinygif || gif.media_formats.gif;

            if (gifMedia) {
                const gifImg = document.createElement('img');
                gifImg.src = gifMedia.url;
                gifImg.alt = gif.title || 'GIF';
                gifImg.loading = 'lazy';

                gifItem.appendChild(gifImg);
                gifGrid.appendChild(gifItem);

                // GIF seçme olayı
                gifItem.addEventListener('click', () => {
                    selectGif(gif);
                });
            }
        });
    }

    // GIF seçimi
    function selectGif(gif) {
        // Sohbet alanına GIF'i ekle
        const gifUrl = gif.media_formats.gif.url;
        const gifMessage = `[GIF: ${gif.title || 'Chatlify GIF'}](${gifUrl})`;

        // Mevcut metni koru ve GIF referansını ekle
        const currentText = textarea.value;
        textarea.value = currentText ? `${currentText} ${gifMessage}` : gifMessage;

        // Modalı kapat
        hideGifModal();

        // Textarea'ya odaklanma
        textarea.focus();
    }

    // Yükleme durumunu göster
    function showLoadingState() {
        gifLoading.style.display = 'flex';
        gifGrid.innerHTML = '';
        gifError.style.display = 'none';
    }

    // Yükleme durumunu gizle
    function hideLoadingState() {
        gifLoading.style.display = 'none';
    }

    // Hata durumunu göster
    function showErrorState() {
        gifError.style.display = 'block';
        gifGrid.innerHTML = '';
    }

    // Hata durumunu gizle
    function hideErrorState() {
        gifError.style.display = 'none';
    }
}

// ... existing code ...

/**
 * Arkadaş Ekle modülünü kurar
 */
function setupAddFriendModal() {
    const addFriendButton = document.getElementById('add-friend-button');
    const addFriendModal = document.getElementById('addFriendModal');
    const closeModalBtn = addFriendModal?.querySelector('.close-modal-btn');
    const addFriendForm = document.getElementById('add-friend-form');
    const usernameInput = document.getElementById('add-friend-username-input');
    const messageArea = addFriendModal?.querySelector('.modal-message-area');

    if (!addFriendButton || !addFriendModal || !closeModalBtn || !addFriendForm || !usernameInput || !messageArea) {
        console.error('Arkadaş Ekle modalı için gerekli elementler bulunamadı');
        return;
    }

    // Modalı açma fonksiyonu
    function openAddFriendModal() {
        addFriendModal.style.display = 'flex';
        // Animasyon için zamanlama
        setTimeout(() => {
            addFriendModal.classList.add('open');
            usernameInput.focus();
        }, 10);
    }

    // Modalı kapatma fonksiyonu
    function closeAddFriendModal() {
        addFriendModal.classList.remove('open');
        // Animasyon bittikten sonra display:none yap
        setTimeout(() => {
            addFriendModal.style.display = 'none';
            // Formu sıfırla
            addFriendForm.reset();
            messageArea.style.display = 'none';
            messageArea.className = 'modal-message-area';
            messageArea.innerHTML = '';
        }, 300);
    }

    // Arkadaşlık isteği gönderme fonksiyonu
    async function sendFriendRequest(username) {
        if (!username || username.length < 3) {
            showMessage('Lütfen geçerli bir kullanıcı adı girin', 'error');
            return;
        }

        try {
            // Girilen kullanıcı adını ve mevcut kullanıcı ID'sini alıyoruz
            const { data: targetUser, error: userError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('username', username)
                .single();

            if (userError || !targetUser) {
                showMessage(`${username} adlı kullanıcı bulunamadı`, 'error');
                return;
            }

            // Kullanıcı kendine istek göndermeye çalışıyorsa
            if (targetUser.id === currentUserId) {
                showMessage('Kendinize arkadaşlık isteği gönderemezsiniz', 'error');
                return;
            }

            // Zaten arkadaşlık durumu var mı kontrol et
            const { data: existingFriendship, error: checkError } = await supabase
                .from('friendships')
                .select('*')
                .or(`(user_id1.eq.${currentUserId},user_id2.eq.${targetUser.id}),(user_id1.eq.${targetUser.id},user_id2.eq.${currentUserId})`)
                .single();

            if (!checkError && existingFriendship) {
                if (existingFriendship.status === 'accepted') {
                    showMessage(`${username} zaten arkadaş listenizde`, 'error');
                } else if (existingFriendship.status === 'pending') {
                    if (existingFriendship.user_id1 === currentUserId) {
                        showMessage(`${username} kullanıcısına zaten bir istek gönderdiniz`, 'error');
                    } else {
                        showMessage(`${username} size zaten bir arkadaşlık isteği göndermiş`, 'error');
                    }
                }
                return;
            }

            // Yeni arkadaşlık isteği oluştur
            const { data: newRequest, error: insertError } = await supabase
                .from('friendships')
                .insert({
                    user_id1: currentUserId,
                    user_id2: targetUser.id,
                    status: 'pending',
                    created_at: new Date()
                })
                .select()
                .single();

            if (insertError) {
                console.error('Arkadaşlık isteği gönderme hatası:', insertError);
                showMessage('Arkadaşlık isteği gönderilirken bir hata oluştu', 'error');
                return;
            }

            showMessage(`${username} kullanıcısına arkadaşlık isteği gönderildi`, 'success');

            // Form inputunu temizle ama modalı kapatma
            usernameInput.value = '';

        } catch (error) {
            console.error('Arkadaşlık isteği hatası:', error);
            showMessage('Bir hata oluştu, lütfen tekrar deneyin', 'error');
        }
    }

    // Mesaj gösterme fonksiyonu
    function showMessage(message, type = 'info') {
        messageArea.innerHTML = message;
        messageArea.className = 'modal-message-area ' + type;
        messageArea.style.display = 'block';

        // 5 saniye sonra mesajı kaldır (başarı mesajı ise)
        if (type === 'success') {
            setTimeout(() => {
                messageArea.classList.add('fade-out');
                setTimeout(() => {
                    if (messageArea.classList.contains('fade-out')) {
                        messageArea.style.display = 'none';
                        messageArea.classList.remove('fade-out');
                    }
                }, 300);
            }, 5000);
        }
    }

    // Event Listeners
    addFriendButton.addEventListener('click', openAddFriendModal);
    closeModalBtn.addEventListener('click', closeAddFriendModal);

    // Modal dışı tıklamada kapatma
    addFriendModal.addEventListener('click', (e) => {
        if (e.target === addFriendModal) {
            closeAddFriendModal();
        }
    });

    // Form gönderimini yakala
    addFriendForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        sendFriendRequest(username);
    });

    // ESC tuşu ile kapatma
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && addFriendModal.style.display === 'flex') {
            closeAddFriendModal();
        }
    });
}

// ... existing code ...
