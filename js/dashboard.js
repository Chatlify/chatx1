import { supabase } from './auth_config.js'; // Supabase istemcisini import et
import { initVoiceCallSystem, checkVoiceCallSupport } from './voice-call.js'; // Sesli arama modülünü import et
import { initAddFriendModal } from './components/addFriendModal.js'; // Arkadaş Ekle modalını import et
import { initServerModal } from './components/serverModal.js'; // Sunucu Ekle modalını import et

// Snowflake ID Üretici Başlatma
const snowflake = new window["Snowflake-ID"]();
console.log("Dashboard için Snowflake ID üretici hazır.");

// Global değişkenler tanımları
let currentUserId = null;
let onlineFriends = new Set();
let presenceChannel = null;
let currentConversationId = null; // Aktif sohbet için ID
let messageSubscription = null; // Realtime mesaj aboneliği
let sampleColumnFormat = 'camelCase'; // Varsayılan olarak camelCase formatını kullan
const defaultAvatar = 'images/chatlifyprofile1.png';
let messageNotificationSound = null; // Ses nesnesi için global değişken
let unreadCounts = {}; // Okunmamış mesaj sayaçları { userId: count }
const TENOR_API_KEY = 'AIzaSyCjseHq-Gn4cii_fVDtSX3whyY94orNWPM'; // Tenor API anahtarı

const emojiCategories = {
    'faces': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😠', '😡'],
    'hands': ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '💪', '👂', '👃', '👀', '👅', '👄'],
    'animals': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🦆', '🐓', '🐦', '🐧', '🐢', '🐍', '🦎', '🐙', '🦑', '🦞', '🦀', '🐠', '🐬', '🐋', '🦓', '🦍', '🐘', '🦛', '🦒', '🦘'],
    'food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🧀', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍥', '🥠', '🦪', '🥧', '🍦', '🍩', '🍪', '🍰'],
    'travel': ['🚗', '🚕', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍', '🚂', '🚊', '🚀', '✈️', '🛫', '🛬', '🚁', '⛵️', '🚤', '🚢', '⚓️', '🚧', '🚏', '🗿', '🗼', '🏰', '🏯', '🏟', '🎡', '🎢', '🎠', '⛲️', '🏖', '🏝', '🏜️', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺️', '🏠', '🏡', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩'],
    'symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑'],
    'flags': ['🇹🇷', '🇦🇿', '🇩🇪', '🇬🇧', '🇺🇸', '🇯🇵', '🇰🇷', '🇷🇺', '🇨🇳', '🇧🇷', '🇮🇳', '🇵🇰', '🇫🇷', '🇪🇸', '🇮🇹', '🇵🇹', '🇳🇱', '🇧🇪', '🇬🇷', '🇨🇭', '🇸🇪', '🇩🇰', '🇳🇴', '🇫🇮', '🇦🇹', '🇮🇪', '🇨🇿', '🇵🇱', '🇭🇺', '🇺🇦', '🇧🇬', '🇷🇴', '🇦🇺', '🇨🇦', '🇲🇽', '🇸🇦', '🇦🇪', '🇶🇦', '🇰🇼', '🇮🇷', '🇮🇶', '🇪🇬', '🇿🇦']
};

// YENİ, MERKEZİ PROFİL MODAL FONKSİYONLARI (GLOBAL KAPSAMA TAŞINDI)
async function showNewProfileModal(userId) {
    if (!userId) {
        console.error("Profilini göstermek için kullanıcı ID'si gerekli.");
        return;
    }

    const modalOverlay = document.getElementById('user-profile-modal');
    if (!modalOverlay) {
        console.error('Profil modal elementi (#user-profile-modal) bulunamadı!');
        return;
    }

    try {
        // Yükleniyor durumunu göster (isteğe bağlı)
        modalOverlay.classList.add('loading');

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        modalOverlay.classList.remove('loading');

        if (error) throw error;
        if (!profile) {
            alert('Kullanıcı profili bulunamadı.');
            return;
        };

        populateNewProfileModal(profile, modalOverlay);

        // Modalı göster
        modalOverlay.style.display = 'flex';
        setTimeout(() => modalOverlay.classList.add('active'), 10);

    } catch (error) {
        console.error('Profil bilgileri çekilirken hata:', error);
        alert('Profil bilgileri yüklenirken bir hata oluştu.');
    }
}

function populateNewProfileModal(profile, modal) {
    // Profil verilerini modal elementinin kendisine `dataset` olarak ekleyelim.
    // Bu, verileri butonların olay dinleyicilerine temiz bir şekilde taşımamızı sağlar.
    modal.dataset.userId = profile.id;
    modal.dataset.username = profile.username;
    modal.dataset.avatarUrl = profile.avatar_url || defaultAvatar;

    modal.querySelector('.profile-avatar-modal').src = profile.avatar_url || defaultAvatar;
    modal.querySelector('.profile-username').textContent = profile.username || 'Kullanıcı';

    const tag = profile.username + '#' + (profile.id.substring(0, 4) || '0000');
    modal.querySelector('.profile-tag').textContent = tag;

    modal.querySelector('.profile-bio').textContent = profile.bio || 'Bu kullanıcı henüz bir biyografi eklememiş.';

    const joinDate = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Bilinmiyor';
    modal.querySelector('.profile-membership-date').textContent = joinDate;

    // --- BUTON İŞLEVSELLİĞİ ---
    const messageBtn = modal.querySelector('.message-btn-modal');
    const removeFriendBtn = modal.querySelector('.remove-friend-btn-modal');

    // "Mesaj Gönder" butonu
    messageBtn.onclick = () => {
        const { userId, username, avatarUrl } = modal.dataset;
        hideModal(); // Önce modalı kapat
        setTimeout(() => { // Pürüzsüz bir geçiş için küçük bir gecikme
            openChatPanel(userId, username, avatarUrl);
        }, 300); // Animasyon süresiyle eşleşebilir
    };

    // "Arkadaşlıktan Çıkar" butonu
    removeFriendBtn.onclick = () => {
        const { userId, username, avatarUrl } = modal.dataset;

        // Önce profil panelini kapat
        hideModal();

        // Animasyonun bitmesi için kısa bir bekleme süresi sonrası onay panelini aç
        setTimeout(() => {
            // Mevcut, güvenli onay mekanizmasını kullanıyoruz.
            showRemoveFriendConfirmation(userId, username, avatarUrl);
        }, 300); // Profil paneli kapanma animasyonuyla eşleşen bir süre
    };

    // Modalı kapatma olayını ayarla
    const closeModalBtn = modal.querySelector('.close-modal-btn');
    const hideModal = () => {
        const modalContainer = document.getElementById('user-profile-modal');
        modalContainer.classList.remove('active');
        setTimeout(() => { modalContainer.style.display = 'none'; }, 300);
    };
    closeModalBtn.onclick = hideModal;

    // Arka plana tıklayarak kapatma (zaten vardı ama hideModal'ı kullanacak şekilde güncelleyelim)
    const modalContainer = document.getElementById('user-profile-modal');
    modalContainer.onclick = (e) => {
        if (e.target === modalContainer) {
            hideModal();
        }
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard JS başlatılıyor...');

    // YENİ, MERKEZİ ARKADAŞ EKLEME FORM MANTIĞI - ARTIK DIŞ MODÜLDE.
    // function setupAddFriendForm() { ... }


    try {
        // Element tanımlamaları
        const userPanelUsernameElement = document.querySelector('.dm-footer .dm-user-name');
        const userPanelAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');
        const userPanel = document.querySelector('.dm-footer .dm-user');

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

        // Kullanıcı paneline tıklama olayı dinleyicisi ekle
        if (userPanel) {
            userPanel.addEventListener('click', () => {
                // Kullanıcı kendi profilini açmak için
                if (currentUserId) {
                    showNewProfileModal(currentUserId);
                }
            });
            userPanel.style.cursor = 'pointer'; // İmleç stilini değiştir
        }

        // Emoji butonu seçimi güncellendi - .emoji-btn ile arama kaldırıldı
        const chatEmojiBtn = document.querySelector('.chat-input-area .emoji-btn');
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

        // Emoji picker dinleyicisini kur
        if (chatEmojiBtn && chatTextarea) {
            chatEmojiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleEmojiPanel();
            });
        }

        // GIF picker dinleyicisini kur
        if (chatGifBtn) {
            setupGifPicker(chatGifBtn, chatTextarea);
        }

        // Tüm arkadaşları, DM'leri ve bekleyen istekleri yükle
        await loadInitialData(onlineList, offlineList, dmList, onlineSection, offlineSection, pendingList, pendingCountBadge);

        // Varlığı (presence) başlat
        initializePresence();

        // Arkadaş Ekle modalını kur
        initAddFriendModal();

        // Sunucu Ekle modalını kur
        initServerModal();

        // Bekleyen arkadaşlık istekleri için realtime aboneliğini kur
        setupPendingFriendRequestSubscription();

        // Sesli arama sistemini başlat
        if (checkVoiceCallSupport()) {
            initVoiceCallSystem();
        }

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

            // Bekleyen istekleri veritabanından çek - YENİ SÖZDİZİMİ
            const { data: pendingRequests, error } = await supabase
                .from('friendships')
                .select(`
                    id,
                    user_id_1,
                    user_id_2,
                    sender:user_id_1 (id, username, avatar_url)
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
                const sender = request.sender;
                if (!sender) {
                    console.warn('İstek gönderen kullanıcı bilgileri eksik:', request);
                    return;
                }

                // Güvenli değerler - DÜZELTİLDİ
                const username = sender.username || 'Bilinmeyen Kullanıcı';
                const avatar = sender.avatar_url || defaultAvatar;
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

    // Emoji Paneli ile ilgili olay dinleyicileri (HTML'den taşındı ve uyarlandı)
    const emojiPanel = document.getElementById('emoji-panel');
    if (emojiPanel) {
        const closePanelBtn = emojiPanel.querySelector('.emoji-panel-close');
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', () => {
                closeEmojiPanel(emojiPanel); // closeEmojiPanel fonksiyonunu çağır
            });
        }

        const emojiTabs = emojiPanel.querySelectorAll('.emoji-tab');
        emojiTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                emojiTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const category = tab.getAttribute('data-category');
                loadEmojisForCategory(category, emojiPanel);
            });
        });

        const searchInput = emojiPanel.querySelector('.emoji-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.trim();
                const activeTab = emojiPanel.querySelector('.emoji-tab.active');
                const category = activeTab ? activeTab.getAttribute('data-category') : 'faces';
                if (searchTerm === '') {
                    loadEmojisForCategory(category, emojiPanel);
                } else {
                    searchEmojis(searchTerm, emojiPanel);
                }
            });
        }
        // Başlangıçta ilk kategoriyi yükle
        loadEmojisForCategory('faces', emojiPanel);
    }

    // Panelin dışına tıklanınca kapatılması için olay dinleyicisi (HTML'den taşındı)
    document.addEventListener('click', function (e) {
        const emojiPanelInstance = document.getElementById('emoji-panel');
        if (!emojiPanelInstance || emojiPanelInstance.style.display === 'none') return;

        const emojiButton = document.querySelector('.emoji-btn'); // Ana emoji butonu

        // Tıklama emoji butonuna veya panelin kendisine değilse kapat
        if (e.target !== emojiButton &&
            !emojiButton?.contains(e.target) &&
            !emojiPanelInstance.contains(e.target)) {
            closeEmojiPanel(emojiPanelInstance);
        }
    });

    // Emoji panelini kaydırılabilir yapma (BUG FIX)
    const emojiPanelForScroll = document.getElementById('emoji-panel');
    if (emojiPanelForScroll) {
        const emojiGridForScroll = emojiPanelForScroll.querySelector('.emoji-grid');
        if (emojiGridForScroll) {
            console.log('Emoji grid için kaydırma düzeltmesi uygulanıyor.');
            // Grid'in dikeyde esnemesini ve taşan içeriği kaydırmasını sağla.
            // Panelin kendisinin 'display: flex' ve 'flex-direction: column' olduğunu varsayıyoruz.
            emojiGridForScroll.style.flexGrow = '1';
            emojiGridForScroll.style.overflowY = 'auto';
        }
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

            // Kullanıcı avatarını tüm arayüzde güncelle
            updateAllUserAvatars();

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

// Tüm kullanıcı avatar görüntülerini güncelleme
function updateAllUserAvatars() {
    try {
        // Auth'dan kullanıcı bilgilerini al
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && user.user_metadata && user.user_metadata.avatar_url) {
                const avatarUrl = user.user_metadata.avatar_url;
                console.log('Tüm kullanıcı avatarları güncelleniyor:', avatarUrl);

                // Kullanıcı panelindeki avatarı güncelle
                const userPanelAvatar = document.querySelector('.dm-footer .dm-user-avatar img');
                if (userPanelAvatar) {
                    userPanelAvatar.src = avatarUrl;

                    // Hata durumunda varsayılan avatar kullanımını engelle
                    userPanelAvatar.onerror = function () {
                        console.log('Avatar yüklenirken hata oluştu, yeniden deneniyor...');
                        if (this.src !== avatarUrl) {
                            this.src = avatarUrl;
                        } else {
                            this.src = defaultAvatar;
                        }
                    };
                }

                // Diğer olası kullanıcı avatar görüntülerini güncelle
                document.querySelectorAll('.user-avatar img, .own-message .message-group-avatar img').forEach(img => {
                    img.src = avatarUrl;

                    // Hata durumunda varsayılan avatar kullanımını engelle
                    img.onerror = function () {
                        if (this.src !== avatarUrl) {
                            this.src = avatarUrl;
                        } else {
                            this.src = defaultAvatar;
                        }
                    };
                });
            }
        });
    } catch (error) {
        console.error('Avatar güncellenirken hata:', error);
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
        redirectToLogin();
        return;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.error('Kullanıcı oturumu bulunamadı.');
            redirectToLogin();
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', currentUserId)
            .single();

        if (profileError) {
            console.error('Profil yüklenirken hata oluştu:', profileError.message);
            // Profil olmasa bile meta verilerle devam etmeyi dene
        }

        const profileData = {
            username: profile?.username || user.user_metadata?.username || 'Kullanıcı',
            avatar: user.user_metadata?.avatar || profile?.avatar_url || defaultAvatar
        };

        console.log('Profil bilgileri yüklendi:', profileData);
        updateProfileUI({ profile: profileData }, userPanelUsernameElement, userPanelAvatarElement);

    } catch (error) {
        console.error('Profil yükleme sırasında genel bir hata oluştu:', error);
        setDefaultProfileUI({ userPanelUsernameElement, userPanelAvatarElement });
    }
}

// Profil UI güncellemesi
function updateProfileUI({ profile }, userPanelUsernameElement, userPanelAvatarElement) {
    if (userPanelUsernameElement) {
        userPanelUsernameElement.textContent = profile.username || 'Kullanıcı';
    }

    if (userPanelAvatarElement) {
        // Avatar URL'sini kontrol et ve güvenli bir şekilde ayarla
        const avatarUrl = profile.avatar || defaultAvatar;
        console.log('Avatar URL ayarlanıyor:', avatarUrl);

        // Önce onerror işleyicisini ayarla, sonra src'yi değiştir
        userPanelAvatarElement.onerror = function () {
            console.warn('Profil resmi yüklenemedi, varsayılan görsel kullanılıyor');
            // Sonsuz döngüyü önlemek için kontrol et
            if (this.src !== defaultAvatar) {
                this.src = defaultAvatar;
            }
        };

        userPanelAvatarElement.src = avatarUrl;
    }

    console.log('Profil arayüzü güncellendi:', profile.username, 'Avatar:', profile.avatar);
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

// Yükleme durumunu gösteren yardımcı fonksiyon
function showLoadingState() {
    const onlineList = document.querySelector('.online-friends');
    const offlineList = document.querySelector('.offline-friends');
    const dmList = document.querySelector('#friends-group .dm-items');

    if (onlineList) onlineList.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Yükleniyor...</div>';
    if (offlineList) offlineList.innerHTML = '';
    if (dmList) dmList.innerHTML = '';
}

// Listeleri temizleyen yardımcı fonksiyon
function clearLists() {
    const onlineList = document.querySelector('.online-friends');
    const offlineList = document.querySelector('.offline-friends');
    const dmList = document.querySelector('#friends-group .dm-items');

    if (onlineList) onlineList.innerHTML = '';
    if (offlineList) offlineList.innerHTML = '';
    if (dmList) dmList.innerHTML = '';
}

// Boş durumunu gösteren yardımcı fonksiyon
function showEmptyState() {
    const offlineList = document.querySelector('.offline-friends');
    const dmList = document.querySelector('#friends-group .dm-items');
    const onlineSection = document.querySelector('.online-section-title');
    const offlineSection = document.querySelector('.offline-section-title');

    if (offlineList) offlineList.innerHTML = '<div class="empty-placeholder">Henüz hiç arkadaşınız yok.</div>';
    if (dmList) dmList.innerHTML = '<div class="empty-placeholder dm-empty">Henüz hiç özel mesajınız yok.</div>';

    // Başlıkları gizle
    if (onlineSection) onlineSection.style.display = 'none';
    if (offlineSection) offlineSection.style.display = 'block'; // "Çevrimdışı" başlığı görünsün
}

// Hata durumunu gösteren yardımcı fonksiyon
function showError(message) {
    const onlineList = document.querySelector('.online-friends');
    if (onlineList) onlineList.innerHTML = `<div class="error-placeholder">${message}</div>`;
}

// Tüm arkadaşları yükleme fonksiyonu (optimize edilmiş)
async function loadAllFriends({ onlineList, offlineList, dmList, onlineSection, offlineSection }) {
    showLoadingState();

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Oturum bulunamadı.");
        currentUserId = user.id;

        const { data: friendships, error } = await supabase
            .from('friendships')
            .select(`
                user_id_1,
                user_id_2,
                status,
                profiles_1:user_id_1 ( id, username, avatar_url ),
                profiles_2:user_id_2 ( id, username, avatar_url )
            `)
            .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`)
            .eq('status', 'accepted');

        if (error) throw error;

        clearLists();

        if (friendships.length === 0) {
            showEmptyState();
            return;
        }

        const friends = friendships.map(f => {
            const friendProfile = f.user_id_1 === user.id ? f.profiles_2 : f.profiles_1;
            return {
                id: friendProfile.id,
                username: friendProfile.username,
                avatar_url: friendProfile.avatar_url,
                isOnline: onlineFriends.has(friendProfile.id)
            };
        });

        const online = friends.filter(f => f.isOnline);
        const offline = friends.filter(f => !f.isOnline);

        // Çevrimiçi arkadaşları ekle
        if (online.length > 0) {
            onlineSection.style.display = 'block';
            online.forEach(friend => {
                onlineList.appendChild(createFriendRow(friend.id, friend.username, friend.avatar_url));
                dmList.appendChild(createDMRow(friend.id, friend.username, friend.avatar_url, true));
            });
        } else {
            onlineSection.style.display = 'none';
        }

        // Çevrimdışı arkadaşları ekle
        if (offline.length > 0) {
            offlineSection.style.display = 'block';
            offline.forEach(friend => {
                offlineList.appendChild(createFriendRow(friend.id, friend.username, friend.avatar_url));
                dmList.appendChild(createDMRow(friend.id, friend.username, friend.avatar_url, false));
            });
        } else {
            offlineSection.style.display = 'none';
        }

    } catch (err) {
        showError(err.message);
        console.error("Arkadaşlar yüklenirken hata:", err);
    } finally {
        updateFriendCounters();
    }
}

function createFriendRow(userId, username, avatarUrl) {
    const friendRow = document.createElement('div');
    friendRow.className = 'friend-row';
    friendRow.dataset.userId = userId;
    friendRow.dataset.username = username; // Veri özniteliklerini ekle
    friendRow.dataset.avatar = avatarUrl || defaultAvatar; // Veri özniteliklerini ekle

    const isOnline = onlineFriends.has(userId);
    friendRow.classList.toggle('online', isOnline);

    friendRow.innerHTML = `
        <div class="friend-avatar">
            <img src="${avatarUrl || defaultAvatar}" alt="${username}">
            <span class="status-dot ${isOnline ? 'online' : ''}"></span>
        </div>
        <div class="friend-info">
            <div class="friend-name">${username}</div>
            <div class="friend-status">${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
        </div>
        <div class="friend-actions">
            <button class="friend-action-btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment"></i></button>
            <button class="friend-action-btn profile-btn" title="Profil"><i class="fas fa-user"></i></button>
            <button class="friend-action-btn more-btn" title="Daha Fazla"><i class="fas fa-ellipsis-v"></i></button>
        </div>
    `;

    friendRow.querySelector('.message-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openChatPanel(userId, username, avatarUrl);
    });

    // Profil butonuna tıklama olayı dinleyicisi ekle
    friendRow.querySelector('.profile-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showNewProfileModal(userId);
    });

    return friendRow;
}

function createDMRow(userId, username, avatarUrl, isOnline) {
    const dmRow = document.createElement('div');
    dmRow.className = 'dm-item';
    dmRow.dataset.userId = userId;

    dmRow.innerHTML = `
        <div class="dm-avatar">
            <img src="${avatarUrl || defaultAvatar}" alt="${username}">
            <div class="dm-status ${isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="dm-info">
            <div class="dm-name">${username}</div>
            <div class="dm-activity">${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
        </div>
        <div class="unread-badge" style="display: none;">0</div>
    `;

    dmRow.addEventListener('click', () => openChatPanel(userId, username, avatarUrl));

    return dmRow;
}

// Bekleyen istekleri yükleme
async function loadPendingRequests(pendingList, pendingCountBadge) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: requests, error } = await supabase
            .from('friendships')
            .select(`
                id,
                user_id_1,
                status,
                sender:user_id_1 (id, username, avatar_url)
            `)
            .eq('user_id_2', user.id)
            .eq('status', 'pending');

        if (error) throw error;

        // Bekleyen isteklerin sayısını göster
        const pendingCount = requests ? requests.length : 0;

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

    // Dinlenecek ana konteynerlar - DÜZELTİLDİ VE GENİŞLETİLDİ
    const listenAreas = [
        document.querySelector('#friends-group .dm-items'), // DM listesi
        document.querySelector('.friends-panel-container')  // Arkadaş paneli
    ];

    listenAreas.forEach(area => {
        if (!area) {
            console.warn("Context menu için dinlenecek alan bulunamadı:", area);
            return;
        };

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
    console.debug("buildContextMenuContent çağrıldı:", userId, username, avatar); // Debug log

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
        {
            label: 'Profil',
            icon: 'fa-user',
            action: function () {
                showNewProfileModal(userId);
            }
        },
        {
            label: 'Mesaj Gönder',
            icon: 'fa-comment',
            action: function () {
                console.debug("Mesaj butonuna tıklandı, openChatPanel çağrılıyor:", userId, username, avatar); // Debug log
                // DM listesindeki avatarı bulup openChatPanel'e göndermek daha doğru olabilir
                // Şimdilik dataset'ten gelen avatarı kullanıyoruz
                openChatPanel(userId, username, avatar);
            }
        },
        {
            label: 'Arkadaşlıktan Çıkar',
            icon: 'fa-user-times',
            action: function () {
                console.debug("Arkadaşlıktan çıkar butonuna tıklandı:", userId, username, avatar); // Debug log
                showRemoveFriendConfirmation(userId, username, avatar);
            },
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
        menuItem.addEventListener('click', (e) => {
            console.debug(`Menü öğesine tıklandı: ${itemData.label}`); // Debug log
            e.stopPropagation(); // Event balonlanmasını engelle

            // Action'ı çağır
            itemData.action();

            // Menüyü gizle
            hideContextMenu(menu);
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
    // Sohbet paneli açıldığında o sohbete özel bir ID üretelim
    const conversationId = snowflake.generate();
    console.log(`%cSohbet Kanal ID'si: %c${conversationId}`, 'font-weight: bold; color: blue;', 'color: green;');
    console.log(`Sohbet başlatıldı: ${username} (ID: ${userId})`);

    // YENİ EKLENEN KISIM: URL'yi güncelle
    const newUrl = `/channels/@me/${conversationId}`;
    history.pushState({ userId: userId, conversationId: conversationId }, '', newUrl);
    console.log(`URL güncellendi: ${newUrl}`);

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

    // Kullanıcının çevrimiçi durumunu belirle
    const userIsOnline = onlineFriends.has(userId);
    chatPanel.dataset.userIsOnline = userIsOnline ? 'true' : 'false';

    const chatHeader = chatPanel.querySelector('.chat-header');
    const chatUsername = chatPanel.querySelector('.chat-username');
    const chatAvatar = chatPanel.querySelector('.chat-avatar img');
}

// Sohbet panelini kapatma
function closeChatPanel() {
    // YENİ EKLENEN KISIM: URL'yi ana görünüme geri döndür - DÜZELTİLDİ
    history.pushState({}, '', '/dashboard');
    console.log(`Sohbet paneli kapatıldı, URL güncellendi: /dashboard`);

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
            showNewProfileModal(userId);
        });
    }
}

// Kullanıcının mesajlarını yükleme - RLS sorunlarına karşı GÜÇLENDİRİLMİŞ YAPI
async function loadConversationMessages(conversationId) {
    const chatMessagesContainer = document.querySelector('.chat-panel .chat-messages');
    if (!chatMessagesContainer) {
        console.error("loadConversationMessages: chatMessagesContainer bulunamadı.");
        return;
    }

    chatMessagesContainer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        // Adım 1: Mesajları çek
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('conversationId', conversationId)
            .order('createdAt', { ascending: true });

        if (messagesError) throw messagesError;

        if (messages.length === 0) {
            chatMessagesContainer.innerHTML = '<div class="no-messages">Bu sohbetin başlangıcı.</div>';
            return;
        }

        // Adım 2: Mesajları gönderenlerin benzersiz ID'lerini topla
        const authorIds = [...new Set(messages.map(msg => msg.senderId).filter(id => id))];

        // Adım 3: Gönderenlerin profillerini tek bir sorguda çek
        let profilesMap = new Map();
        if (authorIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .in('id', authorIds);

            if (profilesError) throw profilesError;

            // Adım 4: Profilleri kolay erişim için bir haritaya dönüştür
            profilesMap = new Map(profiles.map(p => [p.id, p]));
        }

        // Adım 5: Mesajları ve profilleri birleştirerek görüntüle
        chatMessagesContainer.innerHTML = ''; // Yükleme animasyonunu temizle
        for (const message of messages) {
            const author = profilesMap.get(message.senderId);
            const authorName = author?.username || 'Bilinmeyen Kullanıcı';
            const authorAvatar = author?.avatar_url || defaultAvatar;
            displayMessage(message, authorName, authorAvatar);
        }

        // Sohbeti en sona kaydır
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    } catch (error) {
        console.error('Mesajlar yüklenemedi:', error);
        chatMessagesContainer.innerHTML = '<div class="error-message">Mesajlar yüklenirken bir hata oluştu.</div>';
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
                            .from('profiles')
                            .select('username, avatar_url')
                            .eq('id', senderId)
                            .maybeSingle();
                        if (error) throw error;
                        if (profile) {
                            senderUsername = profile.username || senderUsername;
                            senderAvatar = profile.avatar_url || senderAvatar;
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
    const isOwnMessage = senderId === currentUserId || source === 'local-sent'; // 'local-sent' kaynağını da kontrol et
    const displayName = isOwnMessage ? 'Sen' : (authorName || 'Kullanıcı');
    let displayAvatar = defaultAvatar;

    if (isOwnMessage) {
        // Kendi mesajımızsa, alt paneldeki avatarı kullan
        const userAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');
        if (userAvatarElement && userAvatarElement.src) {
            displayAvatar = userAvatarElement.src;
        }
    } else {
        // Başkasının mesajıysa, sağlanan avatarı veya sohbet başlığındaki avatarı kullan
        displayAvatar = authorAvatar || document.querySelector('.chat-header .chat-avatar img')?.src || defaultAvatar;
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
            await sendTextMessageFromTextarea(newTextarea);
        }
    });

    // Gönder butonu için event listener
    const sendButton = document.querySelector('.chat-submit .chat-send-btn'); // Selector güncellendi
    if (sendButton) {
        const newSendButton = sendButton.cloneNode(true);
        if (sendButton.parentNode) {
            sendButton.parentNode.replaceChild(newSendButton, sendButton);
        }

        newSendButton.addEventListener('click', async () => {
            await sendTextMessageFromTextarea(newTextarea);
        });
    }

    // Metin mesajını textarea'dan gönderme yardımcı fonksiyonu
    async function sendTextMessageFromTextarea(textarea) {
        const messageText = textarea.value.trim();
        if (messageText) {
            await sendMessage(messageText, 'text');
            textarea.value = ''; // Textarea'yı temizle
            textarea.style.height = 'auto'; // Yüksekliği sıfırla (eğer otomatik yükseklik ayarı varsa)
        }
    }
}

// Genel mesaj gönderme fonksiyonu (metin veya yapılandırılmış içerik için)
async function sendMessage(content, contentType = 'text') {
    if (!content || !currentConversationId) {
        console.warn('Mesaj göndermek için içerik ve geçerli conversationId gerekli.');
        return;
    }

    let messageContentString;
    if (contentType === 'gif') {
        // content: { type: 'gif', url: '...', title: '...' }
        messageContentString = JSON.stringify(content);
    } else {
        messageContentString = content; // Düz metin
    }

    console.log(`Mesaj gönderiliyor (${contentType}): ${messageContentString} (ConversationID: ${currentConversationId}, SenderID: ${currentUserId})`);

    try {
        const messageData = {
            content: messageContentString,
            senderId: currentUserId,
            conversationId: currentConversationId,
        };

        const { data, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select(); // .select() ekledik ki dönen veriyi alabilelim

        if (error) {
            console.error('Mesaj eklenirken Supabase hatası:', error);
            if (error.code === '23514') {
                alert('Mesaj gönderilemedi. (Kural İhlali: ' + error.message + ')');
            } else {
                alert('Mesaj gönderilemedi. Lütfen tekrar deneyiniz.');
            }
            throw error;
        }

        if (data && data.length > 0) {
            console.log('Mesaj başarıyla gönderildi:', data[0]);
            // Kendi gönderdiğimiz mesajı hemen göstermek için displayMessage'ı çağırıyoruz.
            // 'Sen' ve 'local-sent' ile kendi avatarımızın doğru yüklenmesini sağlıyoruz.
            const userAvatarElement = document.querySelector('.dm-footer .dm-user-avatar img');
            const ownAvatar = userAvatarElement ? userAvatarElement.src : defaultAvatar;
            displayMessage(data[0], 'Sen', ownAvatar, 'local-sent');
        }
    } catch (error) {
        console.error('Mesaj gönderilirken genel hata:', error);
        // Hata zaten kullanıcıya gösterildi.
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
            emojis: ['👋', '🤚', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🫀', '🫁', '🧠', '🦷', '🦴', '👀', '👅', '👄', '🫦']
        },
        {
            name: 'Hayvanlar',
            icon: 'fa-paw',
            emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🪿', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀']
        },
        {
            name: 'Yiyecek',
            icon: 'fa-utensils',
            emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '8', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪']
        },
        {
            name: 'Etkinlik',
            icon: 'fa-cake-candles',
            emojis: ['🎉', '🎊', '🎈', '🎂', '🎀', '🎁', '🎄', '🎃', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉', '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎮', '🎰', '🎲', '🧩', '🎭', '🎨', '🧵', '🪡', '🧶', '🪢']
        },
        {
            name: 'Seyahat',
            icon: 'fa-car',
            emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🚏', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲️', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️']
        },
        {
            name: 'Semboller',
            icon: 'fa-icons',
            emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓️', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔']
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
            background: linear-gradient(145deg, #2d3558, #1f263f);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            z-index: 100;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            transform-origin: right center;
            box-shadow: -5px 0 25px rgba(0, 0, 0, 0.3);
            font-family: 'Poppins', sans-serif;
            border-radius: 12px 0 0 12px;
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
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes foldPanel {
            0% { transform: translateX(0); opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
        }

        #emoji-panel .emoji-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            background: linear-gradient(145deg, #343c61, #2a3050);
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
        }

        #emoji-panel .emoji-panel-title {
            font-weight: 600;
            color: var(--text-color, white);
            font-size: 16px;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
        }
        
        #emoji-panel .emoji-panel-title::before {
            content: "😊";
            margin-right: 8px;
            font-size: 18px;
        }

        #emoji-panel .emoji-panel-close {
            background: rgba(255, 255, 255, 0.08);
            border: none;
            color: var(--text-secondary, #b9bbbe);
            cursor: pointer;
            font-size: 14px;
            padding: 6px;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        #emoji-panel .emoji-panel-close:hover {
            color: var(--text-color, white);
            background-color: rgba(255, 255, 255, 0.15);
            transform: scale(1.05);
        }
        
        #emoji-panel .emoji-panel-close:active {
            transform: scale(0.95);
        }

        #emoji-panel .emoji-search {
            padding: 15px 20px;
            position: relative;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            background: rgba(0, 0, 0, 0.1);
        }

        #emoji-panel .emoji-search-input {
            width: 100%;
            padding: 12px 40px 12px 15px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background-color: rgba(0, 0, 0, 0.2);
            color: var(--text-color, white);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        
        #emoji-panel .emoji-search-input:focus {
            border-color: var(--primary-color, #7289da);
            box-shadow: 0 0 0 2px rgba(114, 137, 218, 0.15);
        }
        
        #emoji-panel .emoji-search-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        #emoji-panel .emoji-search-icon {
            position: absolute;
            right: 30px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted, #72767d);
            pointer-events: none;
        }

        #emoji-panel .emoji-panel-tabs {
            display: flex;
            overflow-x: auto;
            padding: 12px 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            background: rgba(0, 0, 0, 0.1);
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, #202225) transparent;
        }

        #emoji-panel .emoji-tab {
            background: rgba(255, 255, 255, 0.05);
            border: none;
            color: var(--text-secondary, #b9bbbe);
            padding: 10px;
            margin: 0 5px;
            cursor: pointer;
            border-radius: 8px;
            flex-shrink: 0;
            transition: all 0.2s;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        #emoji-panel .emoji-tab:hover {
            background-color: rgba(255, 255, 255, 0.1);
            color: var(--text-color, white);
            transform: translateY(-2px);
        }
        
        #emoji-panel .emoji-tab.active {
            background: linear-gradient(135deg, var(--primary-color, #7289da), #5a70c2);
            color: white;
            box-shadow: 0 4px 10px rgba(114, 137, 218, 0.3);
        }
        
        #emoji-panel .emoji-tab:first-child {
            margin-left: 0;
        }

        #emoji-panel .emoji-container {
            padding: 15px;
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
            overflow-y: auto;
            flex-grow: 1;
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, #202225) transparent;
            background: rgba(0, 0, 0, 0.05);
        }

        #emoji-panel .emoji-category-title {
            grid-column: 1 / -1;
            color: var(--text-secondary, #b9bbbe);
            font-size: 12px;
            margin: 5px 0;
            font-weight: 600;
            padding: 4px 0;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
        }

        #emoji-panel .emoji-item {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            height: 44px;
            width: 44px;
            border-radius: 9px;
            transition: all 0.15s ease;
            background: rgba(255, 255, 255, 0.04);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        #emoji-panel .emoji-item:hover {
            background-color: rgba(255, 255, 255, 0.15);
            transform: scale(1.1);
            box-shadow: 0 5px 10px rgba(0, 0, 0, 0.15);
            z-index: 1;
        }
        
        #emoji-panel .emoji-item:active {
            transform: scale(1);
        }

        #emoji-panel .emoji-panel-footer {
            padding: 12px 16px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.5);
            font-size: 11px;
            text-align: center;
            background: linear-gradient(145deg, #343c61, #2a3050);
            letter-spacing: 0.5px;
        }
        
        /* Scrollbar stili */
        #emoji-panel .emoji-container::-webkit-scrollbar {
            width: 6px;
        }
        
        #emoji-panel .emoji-container::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
        }
        
        #emoji-panel .emoji-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        #emoji-panel .emoji-container::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.25);
        }
        
        /* Emoji butonu aktif durumu */
        .emoji-btn.active {
            background: linear-gradient(135deg, var(--primary-color, #7289da), #5a70c2) !important;
            color: white !important;
            box-shadow: 0 4px 10px rgba(114, 137, 218, 0.3) !important;
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
                <div class="gif-picker-title">GIF Seçin</div>
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
        gifModal.style.display = 'flex'; // Changed from 'block' to 'flex'
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
    async function selectGif(gif) { // Fonksiyonu async yap
        const gifUrl = gif.media_formats.gif.url;
        const gifTitle = gif.content_description || gif.id; // Başlık yoksa ID kullan

        // GIF mesajını JSON formatında hazırla
        const gifData = {
            type: 'gif',
            url: gifUrl,
            title: gifTitle
        };

        // sendMessage fonksiyonunu kullanarak GIF'i gönder
        await sendMessage(gifData, 'gif');

        // Modalı kapat
        hideGifModal();

        // Textarea'ya odaklanmaya gerek yok, mesaj gönderildi.
        // Textarea'yı temizleyebiliriz (isteğe bağlı)
        if (textarea) {
            textarea.value = '';
            textarea.style.height = 'auto';
        }
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
    // Genel modal kurulum fonksiyonunu çağır
    setupModal('.add-friend-btn', '#add-friend-modal', '.close-modal-btn');

    // Forma özel işlevselliği ekle
    const addFriendForm = document.getElementById('add-friend-form');
    const usernameInput = document.getElementById('add-friend-username-input');

    if (addFriendForm && usernameInput) {
        addFriendForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const username = usernameInput.value.trim();
            if (username) {
                // Mevcut, çalışan gönderme fonksiyonunu kullan
                sendFriendRequest(username);
            }
        });
    } else {
        console.warn("Arkadaş ekle formu veya input'u bulunamadı.");
    }
}

// Sunucu Ekle/Katıl Modal Kurulumu (YENİ)
function setupServerModal() {
    setupModal('.server-add-icon', '#server-modal', '.close-server-modal-btn');
    // Sunucu paneline özel işlevsellikler (katıl/oluştur sekmeleri vb.) buraya eklenecek.
}

// ... existing code ...

// Emoji panelini açıp kapatan fonksiyon
function toggleEmojiPanel() {
    const emojiPanel = document.getElementById('emoji-panel');
    if (!emojiPanel) return;

    const isOpen = emojiPanel.style.display === 'block' || emojiPanel.classList.contains('open');

    if (isOpen) {
        closeEmojiPanel(emojiPanel);
    } else {
        emojiPanel.style.display = 'block';
        emojiButton.classList.add('active');
        setTimeout(() => {
            emojiPanel.classList.add('open');
        }, 10); // CSS animasyonu için küçük bir gecikme
        positionEmojiPanel(emojiPanel); // Paneli konumlandır
        // İlk kategoriyi yükle (eğer daha önce yüklenmediyse veya her açılışta isteniyorsa)
        const activeTab = emojiPanel.querySelector('.emoji-tab.active');
        if (!activeTab) {
            loadEmojisForCategory('faces', emojiPanel);
            const facesTab = emojiPanel.querySelector('.emoji-tab[data-category="faces"]');
            if (facesTab) facesTab.classList.add('active');
        }
    }
}

// Emoji panelini doğru konumlandıran yardımcı fonksiyon
function positionEmojiPanel(panel) {
    if (!panel) panel = document.getElementById('emoji-panel');
    if (!panel) return;

    const chatInputArea = document.querySelector('.chat-input-area');
    if (!chatInputArea) {
        console.error('Chat input alanı bulunamadı, emoji paneli konumlandırılamıyor.');
        // Paneli varsayılan bir konuma (örn: ekranın sağ altı) yerleştirebiliriz veya hata verebiliriz.
        // Şimdilik sağ alta sabitliyoruz.
        panel.style.position = 'fixed';
        panel.style.bottom = '70px'; // CSS'teki değerle aynı
        panel.style.right = '20px';  // CSS'teki değerle aynı
        panel.style.zIndex = '1000';
        return;
    }

    const inputRect = chatInputArea.getBoundingClientRect();
    panel.style.position = 'absolute'; // Ya da 'fixed' olabilir, tasarıma göre
    // Panelin chatInputArea'nın hemen üzerinde olmasını sağlıyoruz.
    // `bottom` değeri, viewport'un altından inputRect'in üstüne olan mesafedir.
    panel.style.bottom = `${window.innerHeight - inputRect.top + 10}px`;
    // `right` değeri, panelin sağ kenarının input alanının sağına hizalanmasını sağlar (veya bir miktar offset)
    panel.style.right = `${window.innerWidth - inputRect.right}px`; // Veya sabit bir değer: '20px'
    panel.style.zIndex = '1000';
}

function closeEmojiPanel(panel, button) {
    if (!panel) panel = document.getElementById('emoji-panel');
    if (!button) button = document.querySelector('.chat-input-area .emoji-btn');

    if (panel) {
        panel.classList.remove('open');
        panel.classList.add('closing');
        if (button) button.classList.remove('active');

        setTimeout(() => {
            panel.classList.remove('closing');
            panel.style.display = 'none';
        }, 200); // CSS animasyon süresiyle eşleşmeli
    }
}

function loadEmojisForCategory(category, panel) {
    if (!panel) panel = document.getElementById('emoji-panel');
    const emojiContainer = panel.querySelector('#emoji-list'); // ID ile seç
    if (!emojiContainer) {
        console.error('Emoji container (#emoji-list) not found in panel:', panel);
        return;
    }

    const emojis = emojiCategories[category] || [];
    emojiContainer.innerHTML = '';

    emojis.forEach(emoji => {
        const emojiItem = document.createElement('div');
        emojiItem.className = 'emoji-item';
        emojiItem.textContent = emoji;
        emojiItem.setAttribute('data-emoji', emoji);
        emojiItem.addEventListener('click', () => {
            insertEmojiToTextarea(emoji);
            closeEmojiPanel(panel); // Emoji seçildikten sonra paneli kapat
        });
        emojiContainer.appendChild(emojiItem);
    });
}

function searchEmojis(term, panel) {
    if (!panel) panel = document.getElementById('emoji-panel');
    const emojiContainer = panel.querySelector('#emoji-list');
    if (!emojiContainer) return;

    const allEmojis = [];
    Object.values(emojiCategories).forEach(catEmojis => allEmojis.push(...catEmojis));

    const matchedEmojis = allEmojis.filter(emoji => emoji.includes(term));

    emojiContainer.innerHTML = '';
    if (matchedEmojis.length === 0) {
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.textContent = 'Sonuç bulunamadı';
        emojiContainer.appendChild(noResults);
    } else {
        matchedEmojis.forEach(emoji => {
            const emojiItem = document.createElement('div');
            emojiItem.className = 'emoji-item';
            emojiItem.textContent = emoji;
            emojiItem.setAttribute('data-emoji', emoji);
            emojiItem.addEventListener('click', () => {
                insertEmojiToTextarea(emoji);
                closeEmojiPanel(panel);
            });
            emojiContainer.appendChild(emojiItem);
        });
    }
}

function insertEmojiToTextarea(emoji) {
    const textarea = document.querySelector('.chat-textbox textarea');
    if (!textarea) {
        console.error('Emoji eklemek için textarea bulunamadı');
        return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + emoji + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.focus();
}

// ... existing code ...

// Profil paneli fonksiyonları
function openProfilePanel(userId, username, avatar) {
    // Remove any existing panel
    const existingPanel = document.getElementById('profile-panel-container');
    if (existingPanel) {
        document.body.removeChild(existingPanel);
    }

    // Create the modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'profile-panel-container';
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.zIndex = '9999';
    modalOverlay.style.backdropFilter = 'blur(8px)';

    // Create the modal content - 16:3 aspect ratio but wider
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#2d3558';
    modalContent.style.borderRadius = '12px';
    modalContent.style.width = '90%'; // Increased from 80%
    modalContent.style.maxWidth = '1200px'; // Increased from 900px
    modalContent.style.height = 'calc(1200px * 3 / 16)'; // 16:3 aspect ratio
    modalContent.style.maxHeight = '225px'; // Slightly increased
    modalContent.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
    modalContent.style.position = 'relative';
    modalContent.style.color = 'white';
    modalContent.style.display = 'flex';
    modalContent.style.overflow = 'hidden';
    modalContent.style.border = '1px solid rgba(255, 255, 255, 0.1)';

    // Create left section with avatar and decorative elements
    const leftSection = document.createElement('div');
    leftSection.style.width = '25%'; // Reduced from 30%
    leftSection.style.position = 'relative';
    leftSection.style.background = 'linear-gradient(135deg, #3a416f 0%, #1f2542 100%)';
    leftSection.style.display = 'flex';
    leftSection.style.alignItems = 'center';
    leftSection.style.justifyContent = 'center';
    leftSection.style.padding = '20px';
    leftSection.style.borderRight = '1px solid rgba(255, 255, 255, 0.1)';
    leftSection.style.overflow = 'hidden';

    // Decorative circles
    const decorCircle1 = document.createElement('div');
    decorCircle1.style.position = 'absolute';
    decorCircle1.style.width = '120px';
    decorCircle1.style.height = '120px';
    decorCircle1.style.borderRadius = '50%';
    decorCircle1.style.background = 'radial-gradient(circle, rgba(106, 120, 209, 0.2) 0%, rgba(106, 120, 209, 0) 70%)';
    decorCircle1.style.top = '-30px';
    decorCircle1.style.left = '-30px';

    const decorCircle2 = document.createElement('div');
    decorCircle2.style.position = 'absolute';
    decorCircle2.style.width = '80px';
    decorCircle2.style.height = '80px';
    decorCircle2.style.borderRadius = '50%';
    decorCircle2.style.background = 'radial-gradient(circle, rgba(106, 120, 209, 0.15) 0%, rgba(106, 120, 209, 0) 70%)';
    decorCircle2.style.bottom = '-20px';
    decorCircle2.style.right = '20px';

    // Avatar container with glow effect
    const avatarContainer = document.createElement('div');
    avatarContainer.style.position = 'relative';
    avatarContainer.style.zIndex = '2';
    avatarContainer.style.width = '120px'; // Increased from 100px
    avatarContainer.style.height = '120px'; // Increased from 100px
    avatarContainer.style.borderRadius = '50%';
    avatarContainer.style.boxShadow = '0 0 20px rgba(106, 120, 209, 0.5)';
    avatarContainer.style.border = '3px solid rgba(255, 255, 255, 0.2)';
    avatarContainer.style.overflow = 'hidden';
    avatarContainer.style.display = 'flex';
    avatarContainer.style.justifyContent = 'center';
    avatarContainer.style.alignItems = 'center';

    // Avatar image
    const avatarImg = document.createElement('img');
    avatarImg.src = avatar || defaultAvatar;
    avatarImg.alt = username;
    avatarImg.style.width = '100%';
    avatarImg.style.height = '100%';
    avatarImg.style.objectFit = 'cover';
    avatarImg.onerror = function () { this.src = defaultAvatar; };

    // Add elements to left section
    avatarContainer.appendChild(avatarImg);
    leftSection.appendChild(decorCircle1);
    leftSection.appendChild(decorCircle2);
    leftSection.appendChild(avatarContainer);

    // Create right section with user info
    const rightSection = document.createElement('div');
    rightSection.style.width = '75%'; // Increased from 70%
    rightSection.style.padding = '20px 30px';
    rightSection.style.display = 'flex';
    rightSection.style.flexDirection = 'column';
    rightSection.style.justifyContent = 'center';
    rightSection.style.position = 'relative';

    // Close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '15px';
    closeButton.style.right = '15px';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'rgba(255, 255, 255, 0.7)';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.transition = 'color 0.2s';
    closeButton.title = 'Kapat';
    closeButton.style.zIndex = '5';
    closeButton.onmouseover = function () { this.style.color = '#fff'; };
    closeButton.onmouseout = function () { this.style.color = 'rgba(255, 255, 255, 0.7)'; };

    // User info container
    const userInfoContainer = document.createElement('div');
    userInfoContainer.style.display = 'flex';
    userInfoContainer.style.flexDirection = 'column';
    userInfoContainer.style.gap = '5px';
    userInfoContainer.style.width = '100%';

    const isOnline = onlineFriends.has(userId);

    // Username with status indicator
    const usernameContainer = document.createElement('div');
    usernameContainer.style.display = 'flex';
    usernameContainer.style.alignItems = 'center';
    usernameContainer.style.gap = '10px';
    usernameContainer.style.marginBottom = '5px';

    const usernameHeading = document.createElement('h3');
    usernameHeading.textContent = username;
    usernameHeading.style.margin = '0';
    usernameHeading.style.fontSize = '28px'; // Increased from 24px
    usernameHeading.style.fontWeight = '600';
    usernameHeading.style.color = '#fff';
    usernameHeading.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';

    // Status indicator
    const statusIndicator = document.createElement('span');
    statusIndicator.style.width = '12px';
    statusIndicator.style.height = '12px';
    statusIndicator.style.borderRadius = '50%';
    statusIndicator.style.backgroundColor = isOnline ? '#4CAF50' : '#9e9e9e';
    statusIndicator.style.boxShadow = isOnline ? '0 0 8px #4CAF50' : 'none';

    // Status text
    const statusText = document.createElement('p');
    statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
    statusText.style.fontSize = '14px';
    statusText.style.color = 'rgba(255, 255, 255, 0.7)';
    statusText.style.margin = '0 0 15px 0';

    // Info grid - now 3 columns
    const infoGrid = document.createElement('div');
    infoGrid.style.display = 'grid';
    infoGrid.style.gridTemplateColumns = '1fr 1fr 1fr'; // Changed from 1fr 1fr
    infoGrid.style.gap = '15px';
    infoGrid.style.marginBottom = '20px';
    infoGrid.style.width = '100%';

    // Join date info
    const joinDateInfo = document.createElement('div');
    joinDateInfo.style.display = 'flex';
    joinDateInfo.style.flexDirection = 'column';
    joinDateInfo.style.gap = '3px';

    const joinDateLabel = document.createElement('span');
    joinDateLabel.textContent = 'Üyelik Tarihi';
    joinDateLabel.style.fontSize = '12px';
    joinDateLabel.style.color = 'rgba(255, 255, 255, 0.5)';
    joinDateLabel.style.textTransform = 'uppercase';
    joinDateLabel.style.letterSpacing = '1px';

    const joinDateValue = document.createElement('span');
    joinDateValue.className = 'join-date';
    joinDateValue.textContent = 'Yükleniyor...';
    joinDateValue.style.fontSize = '16px';
    joinDateValue.style.color = '#fff';
    joinDateValue.style.fontWeight = '500';

    joinDateInfo.appendChild(joinDateLabel);
    joinDateInfo.appendChild(joinDateValue);

    // Message count info (placeholder)
    const messageInfo = document.createElement('div');
    messageInfo.style.display = 'flex';
    messageInfo.style.flexDirection = 'column';
    messageInfo.style.gap = '3px';

    const messageLabel = document.createElement('span');
    messageLabel.textContent = 'Toplam Mesaj';
    messageLabel.style.fontSize = '12px';
    messageLabel.style.color = 'rgba(255, 255, 255, 0.5)';
    messageLabel.style.textTransform = 'uppercase';
    messageLabel.style.letterSpacing = '1px';

    const messageValue = document.createElement('span');
    messageValue.textContent = '124';
    messageValue.style.fontSize = '16px';
    messageValue.style.color = '#fff';
    messageValue.style.fontWeight = '500';

    messageInfo.appendChild(messageLabel);
    messageInfo.appendChild(messageValue);

    // Status info (added)
    const statusInfo = document.createElement('div');
    statusInfo.style.display = 'flex';
    statusInfo.style.flexDirection = 'column';
    statusInfo.style.gap = '3px';

    const statusLabel = document.createElement('span');
    statusLabel.textContent = 'Durum';
    statusLabel.style.fontSize = '12px';
    statusLabel.style.color = 'rgba(255, 255, 255, 0.5)';
    statusLabel.style.textTransform = 'uppercase';
    statusLabel.style.letterSpacing = '1px';

    const statusValueText = document.createElement('span');
    statusValueText.textContent = 'Premium Üye';
    statusValueText.style.fontSize = '16px';
    statusValueText.style.color = '#FFD700'; // Gold color for premium
    statusValueText.style.fontWeight = '500';

    statusInfo.appendChild(statusLabel);
    statusInfo.appendChild(statusValueText);

    // Add info items to grid
    infoGrid.appendChild(joinDateInfo);
    infoGrid.appendChild(messageInfo);
    infoGrid.appendChild(statusInfo);

    // Action buttons container
    const actionButtons = document.createElement('div');
    actionButtons.style.display = 'flex';
    actionButtons.style.gap = '10px';
    actionButtons.style.marginTop = 'auto';
    actionButtons.style.width = '100%';
    actionButtons.style.maxWidth = '600px';

    // Message button
    const messageButton = document.createElement('button');
    messageButton.textContent = 'Mesaj Gönder';
    messageButton.style.backgroundColor = '#6A78D1';
    messageButton.style.border = 'none';
    messageButton.style.color = 'white';
    messageButton.style.padding = '10px 15px'; // Increased from 8px 15px
    messageButton.style.borderRadius = '6px';
    messageButton.style.cursor = 'pointer';
    messageButton.style.fontWeight = '500';
    messageButton.style.flex = '1';
    messageButton.style.transition = 'background-color 0.2s';
    messageButton.onmouseover = function () { this.style.backgroundColor = '#5A68C1'; };
    messageButton.onmouseout = function () { this.style.backgroundColor = '#6A78D1'; };

    // Remove friend button
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Arkadaşlıktan Çıkar';
    removeButton.style.backgroundColor = '#d94848';
    removeButton.style.border = 'none';
    removeButton.style.color = 'white';
    removeButton.style.padding = '10px 15px'; // Increased from 8px 15px
    removeButton.style.borderRadius = '6px';
    removeButton.style.cursor = 'pointer';
    removeButton.style.fontWeight = '500';
    removeButton.style.flex = '1';
    removeButton.style.transition = 'background-color 0.2s';
    removeButton.onmouseover = function () { this.style.backgroundColor = '#c93838'; };
    removeButton.onmouseout = function () { this.style.backgroundColor = '#d94848'; };

    // Add buttons to action container
    actionButtons.appendChild(messageButton);
    actionButtons.appendChild(removeButton);

    // Assemble username container
    usernameContainer.appendChild(usernameHeading);
    usernameContainer.appendChild(statusIndicator);

    // Assemble user info
    userInfoContainer.appendChild(usernameContainer);
    userInfoContainer.appendChild(statusText);
    userInfoContainer.appendChild(infoGrid);
    userInfoContainer.appendChild(actionButtons);

    // Add elements to right section
    rightSection.appendChild(closeButton);
    rightSection.appendChild(userInfoContainer);

    // Decorative elements for right section
    const decorElement = document.createElement('div');
    decorElement.style.position = 'absolute';
    decorElement.style.top = '0';
    decorElement.style.right = '0';
    decorElement.style.width = '150px';
    decorElement.style.height = '150px';
    decorElement.style.background = 'radial-gradient(circle, rgba(106, 120, 209, 0.1) 0%, rgba(106, 120, 209, 0) 70%)';
    decorElement.style.borderRadius = '50%';
    decorElement.style.transform = 'translate(30%, -30%)';
    decorElement.style.zIndex = '1';

    // Add sections to modal content
    rightSection.appendChild(decorElement);
    modalContent.appendChild(leftSection);
    modalContent.appendChild(rightSection);
    modalOverlay.appendChild(modalContent);

    // Add to body
    document.body.appendChild(modalOverlay);

    // Add event listeners
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
    });

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    });

    removeButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
        showRemoveFriendConfirmation(userId, username, avatar);
    });

    messageButton.addEventListener('click', () => {
        document.body.removeChild(modalOverlay);
        openChat(userId, username, avatar);
    });

    // Load join date
    getUserJoinDate(userId).then(date => {
        const joinDateSpan = modalContent.querySelector('.join-date');
        if (joinDateSpan) {
            joinDateSpan.textContent = date;
        }
    });
}

// Now redesign the GIF panel
function openGifPanel() {
    const gifPanelContainer = document.createElement('div');
    gifPanelContainer.id = 'gif-panel';
    gifPanelContainer.className = 'gif-panel';
    gifPanelContainer.style.position = 'absolute';
    gifPanelContainer.style.bottom = '70px';
    gifPanelContainer.style.right = '20px';
    gifPanelContainer.style.width = '360px';
    gifPanelContainer.style.height = '450px';
    gifPanelContainer.style.backgroundColor = '#2d3558';
    gifPanelContainer.style.borderRadius = '12px';
    gifPanelContainer.style.boxShadow = '0 5px 25px rgba(0, 0, 0, 0.3)';
    gifPanelContainer.style.display = 'flex';
    gifPanelContainer.style.flexDirection = 'column';
    gifPanelContainer.style.zIndex = '100';
    gifPanelContainer.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    gifPanelContainer.style.overflow = 'hidden';

    // Header
    const gifPanelHeader = document.createElement('div');
    gifPanelHeader.style.padding = '12px 15px';
    gifPanelHeader.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    gifPanelHeader.style.display = 'flex';
    gifPanelHeader.style.justifyContent = 'space-between';
    gifPanelHeader.style.alignItems = 'center';

    const gifPanelTitle = document.createElement('h3');
    gifPanelTitle.textContent = 'GIF Seçin';
    gifPanelTitle.style.margin = '0';
    gifPanelTitle.style.fontSize = '16px';
    gifPanelTitle.style.fontWeight = '500';
    gifPanelTitle.style.color = '#fff';

    const closeGifPanelBtn = document.createElement('button');
    closeGifPanelBtn.innerHTML = '×';
    closeGifPanelBtn.style.background = 'none';
    closeGifPanelBtn.style.border = 'none';
    closeGifPanelBtn.style.color = 'rgba(255, 255, 255, 0.7)';
    closeGifPanelBtn.style.fontSize = '24px';
    closeGifPanelBtn.style.cursor = 'pointer';
    closeGifPanelBtn.style.padding = '0';
    closeGifPanelBtn.style.lineHeight = '1';
    closeGifPanelBtn.style.transition = 'color 0.2s';
    closeGifPanelBtn.title = 'Kapat';
    closeGifPanelBtn.onmouseover = function () { this.style.color = '#fff'; };
    closeGifPanelBtn.onmouseout = function () { this.style.color = 'rgba(255, 255, 255, 0.7)'; };

    gifPanelHeader.appendChild(gifPanelTitle);
    gifPanelHeader.appendChild(closeGifPanelBtn);

    // Search bar
    const searchContainer = document.createElement('div');
    searchContainer.style.padding = '10px 15px';
    searchContainer.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'GIF ara...';
    searchInput.style.width = '100%';
    searchInput.style.padding = '8px 12px';
    searchInput.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    searchInput.style.border = 'none';
    searchInput.style.borderRadius = '6px';
    searchInput.style.color = '#fff';
    searchInput.style.fontSize = '14px';
    searchInput.style.outline = 'none';
    searchInput.style.transition = 'background-color 0.2s';

    searchInput.onfocus = function () {
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
    };

    searchInput.onblur = function () {
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    };

    searchContainer.appendChild(searchInput);

    // GIFs container
    const gifsContainer = document.createElement('div');
    gifsContainer.className = 'gifs-container';
    gifsContainer.style.flex = '1';
    gifsContainer.style.overflowY = 'auto';
    gifsContainer.style.padding = '10px';
    gifsContainer.style.display = 'grid';
    gifsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    gifsContainer.style.gap = '10px';
    gifsContainer.style.scrollbarWidth = 'thin';
    gifsContainer.style.scrollbarColor = '#6A78D1 #2d3558';

    // Custom scrollbar for webkit browsers
    gifsContainer.style.cssText += `
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
            background: #6A78D1;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #5A68C1;
        }
    `;

    // Loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.style.display = 'flex';
    loadingIndicator.style.justifyContent = 'center';
    loadingIndicator.style.alignItems = 'center';
    loadingIndicator.style.height = '100%';
    loadingIndicator.style.color = '#fff';
    loadingIndicator.textContent = 'GIFler yükleniyor...';

    gifsContainer.appendChild(loadingIndicator);

    // Assemble panel
    gifPanelContainer.appendChild(gifPanelHeader);
    gifPanelContainer.appendChild(searchContainer);
    gifPanelContainer.appendChild(gifsContainer);

    document.querySelector('.chat-container').appendChild(gifPanelContainer);

    // Close button event
    closeGifPanelBtn.addEventListener('click', closeGifPanel);

    // Load trending GIFs
    loadTrendingGifs();

    // Search event
    let searchTimeout;
    searchInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        const query = this.value.trim();

        searchTimeout = setTimeout(() => {
            if (query) {
                searchGifs(query);
            } else {
                loadTrendingGifs();
            }
        }, 500);
    });
}

// Function to load trending GIFs
function loadTrendingGifs() {
    const gifsContainer = document.querySelector('.gifs-container');
    if (!gifsContainer) return;

    gifsContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff;">GIFler yükleniyor...</div>';

    fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${giphyApiKey}&limit=20`)
        .then(response => response.json())
        .then(data => {
            displayGifs(data.data);
        })
        .catch(error => {
            console.error('Error fetching trending GIFs:', error);
            gifsContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff;">GIFler yüklenemedi.</div>';
        });
}

// Function to search GIFs
function searchGifs(query) {
    const gifsContainer = document.querySelector('.gifs-container');
    if (!gifsContainer) return;

    gifsContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff;">GIFler aranıyor...</div>';

    fetch(`https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${encodeURIComponent(query)}&limit=20`)
        .then(response => response.json())
        .then(data => {
            displayGifs(data.data);
        })
        .catch(error => {
            console.error('Error searching GIFs:', error);
            gifsContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff;">GIFler yüklenemedi.</div>';
        });
}

// Function to display GIFs
function displayGifs(gifs) {
    const gifsContainer = document.querySelector('.gifs-container');
    if (!gifsContainer) return;

    gifsContainer.innerHTML = '';

    if (gifs.length === 0) {
        gifsContainer.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #fff;">Sonuç bulunamadı.</div>';
        return;
    }

    gifs.forEach(gif => {
        const gifItem = document.createElement('div');
        gifItem.className = 'gif-item';
        gifItem.style.position = 'relative';
        gifItem.style.borderRadius = '8px';
        gifItem.style.overflow = 'hidden';
        gifItem.style.cursor = 'pointer';
        gifItem.style.aspectRatio = '16/9'; // Landscape aspect ratio
        gifItem.style.backgroundColor = '#1f2542';
        gifItem.style.transition = 'transform 0.2s';
        gifItem.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';

        // Hover effect
        gifItem.onmouseover = function () {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        };

        gifItem.onmouseout = function () {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
        };

        const gifImg = document.createElement('img');
        gifImg.src = gif.images.fixed_height.url;
        gifImg.alt = gif.title;
        gifImg.style.width = '100%';
        gifImg.style.height = '100%';
        gifImg.style.objectFit = 'cover';
        gifImg.style.objectPosition = 'center';
        gifImg.loading = 'lazy';

        gifItem.appendChild(gifImg);
        gifsContainer.appendChild(gifItem);

        // Click event
        gifItem.addEventListener('click', function () {
            sendGif(gif.images.original.url);
            closeGifPanel();
        });
    });
}

// Function to close GIF panel
function closeGifPanel() {
    const gifPanel = document.getElementById('gif-panel');
    if (gifPanel) {
        gifPanel.parentNode.removeChild(gifPanel);
    }
}

// Function to send a GIF
function sendGif(gifUrl) {
    const currentChat = document.querySelector('.chat-messages');
    if (!currentChat) return;

    const currentUserId = getCurrentUserId();
    const activeChat = getActiveChat();

    if (!activeChat) {
        console.error('No active chat found');
        return;
    }

    const messageData = {
        sender: currentUserId,
        receiver: activeChat.userId,
        content: gifUrl,
        type: 'gif',
        timestamp: new Date().toISOString()
    };

    // Add to UI
    addMessageToUI(messageData, true);

    // Save to local storage
    saveMessageToStorage(messageData);

    // Update last message in chat list
    updateLastMessageInChatList(activeChat.userId, 'GIF gönderdi', new Date().toISOString());

    // Scroll to bottom
    scrollToBottom();
}

// Arkadaşlıktan Çıkarma Onay Modalını Göster (YENİ VE GELİŞMİŞ)
function showRemoveFriendConfirmation(userId, username, avatar) {
    const modal = document.getElementById('confirmation-modal');
    const title = modal.querySelector('#confirmation-title');
    const text = modal.querySelector('#confirmation-text');
    const confirmBtn = modal.querySelector('#confirm-action-btn');
    const cancelBtn = modal.querySelector('#cancel-confirmation-btn');

    // Modalı doldur
    title.textContent = `${username} Kişisini Arkadaşlıktan Çıkar`;
    text.innerHTML = `<strong>${username}</strong> kişisini arkadaş listenizden kalıcı olarak kaldırmak istediğinizden emin misiniz? Bu işlem geri alınamaz.`;

    // Onay butonunu tehlike moduna al
    confirmBtn.textContent = 'Arkadaşlıktan Çıkar';
    confirmBtn.className = 'confirmation-btn confirm-btn-danger';

    // Modalı göster
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    // Kapatma fonksiyonu
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            // Olay dinleyicilerini temizle (önemli!)
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        }, 200);
    };

    // Buton olaylarını ayarla
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = async () => {
        await removeFriend(userId);
        closeModal(); // İşlem bittikten sonra onayı kapat
    };
}

// Arkadaşı Silme İşlemi
async function removeFriend(friendId) {
    if (!currentUserId || !friendId) {
        console.error("Arkadaş silmek için her iki kullanıcı ID'si de gereklidir.");
        return;
    }
    try {
        const { error } = await supabase
            .from('friendships')
            .delete()
            .or(`(user_id_1.eq.${currentUserId},and,user_id_2.eq.${friendId}),(user_id_1.eq.${friendId},and,user_id_2.eq.${currentUserId})`);

        if (error) throw error;

        console.log(`Kullanıcı (ID: ${friendId}) arkadaşlıktan başarıyla çıkarıldı.`);

        // Arayüzü güncelle: Arkadaş listesini yeniden yükle
        await loadAllFriends({
            onlineList: document.querySelector('.online-friends'),
            offlineList: document.querySelector('.offline-friends'),
            dmList: document.querySelector('#friends-group .dm-items'),
            onlineSection: document.querySelector('.online-section-title'),
            offlineSection: document.querySelector('.offline-section-title')
        });

        // Eğer açıksa, profil panelini kapat
        const modalContainer = document.getElementById('user-profile-modal');
        if (modalContainer.style.display !== 'none') {
            modalContainer.classList.remove('active');
            setTimeout(() => { modalContainer.style.display = 'none'; }, 300);
        }

    } catch (error) {
        console.error('Arkadaş silinirken hata oluştu:', error);
        alert('Arkadaşlıktan çıkarma işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    }
}

// Arama kutusu işlevselliği
function setupSearchBox() {
    const searchInput = document.querySelector('.search-box input');
    // ... existing code ...
}
