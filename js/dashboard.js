import { supabase } from './auth_config.js'; // Supabase istemcisini import et

// Global değişkenler tanımları
let currentUserId = null;
let onlineFriends = new Set();
let presenceChannel = null;
let currentConversationId = null; // Aktif sohbet için ID
let messageSubscription = null; // Realtime mesaj aboneliği
let sampleColumnFormat = 'camelCase'; // Varsayılan olarak camelCase formatını kullan
const defaultAvatar = 'images/chatlifyprofile1.png'; // Varsayılan avatar - lokal resim kullanıyoruz
let messageNotificationSound = null; // Ses nesnesi için global değişken
let unreadCounts = {}; // Okunmamış mesaj sayaçları { userId: count }

// Tenor API anahtarını doğrudan tanımla
// DİKKAT: API anahtarını doğrudan istemci koduna yazmak güvenlik riski taşır.
// İdealde bu anahtar backend üzerinden veya güvenli bir yapılandırma ile yönetilmelidir.
const TENOR_API_KEY = "AIzaSyDPnKkjVyVEbfnxRsNjAVgaU8jkAaQP4Vk"; // Geçici demo anahtar - üretimde değiştirin!

// API anahtarı kontrolü
if (!TENOR_API_KEY || TENOR_API_KEY === "YOUR_TENOR_API_KEY") {
    console.error('Tenor API anahtarı bulunamadı veya güncellenmemiş! GIF özellikleri çalışmayabilir. Lütfen js/dashboard.js dosyasını kontrol edin.');
    // alert("Tenor API anahtarı eksik. GIF özellikleri kullanılamayacak.");
}

// Demo mod kontrolü - sayfa URL'inde ?demo=true parametresi varsa demo modda çalış
const urlParams = new URLSearchParams(window.location.search);
const isDemoMode = urlParams.get('demo') === 'true';

// ... existing code ...

// Sesli arama için değişkenler
let peerConnection = null;
let localStream = null;
let remoteStream = null;
let callTimeout = null;
let callTimer = null;
let callDuration = 0;
let activeCallUserId = null;
let isMuted = false;

// WebRTC yapılandırması - STUN sunucuları
const servers = {
    iceServers: [
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
            ],
        },
    ],
};

// Sayfa yüklendiğinde - DOM içinde binding işlemlerini yapar
document.addEventListener('DOMContentLoaded', async () => {
    // Loading screen'i doğrudan kaldır (animasyon olmadan)
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    try {
        // Placeholder resim hatalarını düzelt
        fixPlaceholderImages();

        // Kullanıcı oturumunu başlat
        const userPanelUsernameElement = document.querySelector('.dm-user-name');
        const userPanelAvatarElement = document.querySelector('.dm-user-avatar img');

        await initializeUserSession({
            userPanelUsernameElement,
            userPanelAvatarElement
        });

        // Arkadaşları yükle
        await loadFriends();

        // Mesaj bildirim sesini yükle
        loadNotificationSound();

        // Realtime mesaj dinleyicisini başlat
        subscribeToPresence();

        // Arama ve sohbet dinleyicilerini ekle
        addChatEventListeners();

        // Sohbet başlığındaki sesli arama butonunu bul ve işlev ekle
        const voiceCallBtn = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', handleVoiceCallButtonClick);
        }

        // Arama paneli butonlarını ayarla
        setupCallPanelButtons();

        console.log('Dashboard başarıyla yüklendi');
    } catch (error) {
        console.error('Dashboard yüklenirken hata:', error);
        showNotification('Bağlantı hatası: ' + error.message, 'error');
    }
});

// Placeholder resim hatalarını düzeltme
function fixPlaceholderImages() {
    // Via placeholder servisi çalışmıyor, lokal resimleri kullan
    const avatarImages = document.querySelectorAll('img[src^="https://via.placeholder.com"]');

    avatarImages.forEach((img) => {
        // Orijinal src'yi veri olarak sakla
        const originalSrc = img.getAttribute('src');
        img.dataset.originalSrc = originalSrc;

        // Varsayılan avatar kullan
        img.src = defaultAvatar;

        // Alternatif text bil
        const altText = img.getAttribute('alt') || 'Avatar';

        // Bir hata olursa tekrar dene
        img.onerror = () => {
            img.src = defaultAvatar;
            console.log(`Avatar yüklenemedi, varsayılan kullanılıyor: ${altText}`);
        };
    });

    console.log(`${avatarImages.length} adet placeholder resim yerel resimlerle değiştirildi`);
}

// Arama panel butonlarını ayarla
function setupCallPanelButtons() {
    // Gelen arama paneli butonları
    const acceptCallBtn = document.querySelector('.incoming-call .accept-btn');
    const declineCallBtn = document.querySelector('.incoming-call .decline-btn');

    // Aktif arama paneli butonları
    const hangupBtn = document.querySelector('.active-call .hangup-btn');
    const muteBtn = document.querySelector('.active-call .mute-btn');

    // Giden arama paneli butonu
    const cancelCallBtn = document.querySelector('.outgoing-call .hangup-btn');

    if (acceptCallBtn) {
        acceptCallBtn.addEventListener('click', acceptCall);
    }

    if (declineCallBtn) {
        declineCallBtn.addEventListener('click', declineCall);
    }

    if (hangupBtn) {
        hangupBtn.addEventListener('click', endCall);
    }

    if (muteBtn) {
        muteBtn.addEventListener('click', toggleMute);
    }

    if (cancelCallBtn) {
        cancelCallBtn.addEventListener('click', cancelOutgoingCall);
    }
}

// Sesli arama butonuna tıklandığında
async function handleVoiceCallButtonClick() {
    console.log('Sesli arama butonu tıklandı');
    const chatPanel = document.querySelector('.chat-panel');
    const userId = chatPanel.dataset.activeChatUserId;
    const username = document.querySelector('.chat-header-user .chat-username').textContent;
    const avatar = document.querySelector('.chat-header-user .chat-avatar img').src;

    if (!userId) {
        console.error('Arama için kullanıcı ID bulunamadı');
        return;
    }

    // Kullanıcının çevrimiçi olup olmadığını kontrol et
    const isFriendOnline = onlineFriends.has(userId);
    if (!isFriendOnline) {
        showNotification('Kullanıcı çevrimiçi değil', 'error');
        return;
    }

    // Arama başlat
    startCall(userId, username, avatar);
}

// Sesli arama başlatma
async function startCall(userId, username, avatar) {
    try {
        console.log(`${username} (${userId}) kullanıcısına sesli arama başlatılıyor`);

        // Daha önceden aktif bir arama varsa sonlandır
        if (peerConnection) {
            endCall();
        }

        // Kullanıcı medya erişimi iste
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Arama panelini göster ve bilgileri doldur
        const callPanelOverlay = document.querySelector('.call-panel-overlay');
        const outgoingCallPanel = document.querySelector('.outgoing-call');

        if (!callPanelOverlay || !outgoingCallPanel) {
            console.error('Arama panel elemanları bulunamadı');
            return;
        }

        // Paneli göster
        callPanelOverlay.style.display = 'flex';
        outgoingCallPanel.style.display = 'flex';

        // Kullanıcı bilgilerini güncelle
        const callAvatar = outgoingCallPanel.querySelector('.call-avatar');
        const callUsername = outgoingCallPanel.querySelector('.call-username');

        if (callAvatar) callAvatar.src = avatar || defaultAvatar;
        if (callUsername) callUsername.textContent = username;

        // WebRTC bağlantısını başlat
        peerConnection = new RTCPeerConnection(servers);

        // ICE adaylarını dinle
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // ICE adayını karşı tarafa gönder
                sendCallSignal(userId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Karşı taraftan ses gelince
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
        };

        // Yerel ses akışını bağlantıya ekle
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Teklif oluştur
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Teklifi karşı tarafa gönder
        sendCallSignal(userId, {
            type: 'call-offer',
            offer: offer,
            caller: {
                id: currentUserId,
                username: currentUserUsername || 'Sen',
                avatar: currentUserAvatar || defaultAvatar
            }
        });

        // Aktif arama ID'sini kaydet
        activeCallUserId = userId;

        // Cevap yoksa 30 saniye sonra aramayı iptal et
        callTimeout = setTimeout(() => {
            if (outgoingCallPanel.style.display !== 'none') {
                showNotification('Arama cevapsız kaldı', 'warning');
                cancelOutgoingCall();
            }
        }, 30000);

    } catch (error) {
        console.error('Arama başlatılırken hata:', error);
        showNotification('Arama başlatılamadı: ' + error.message, 'error');

        // Akışı kapat
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

// Arama sinyallerini gönderme
function sendCallSignal(userId, signal) {
    // Realtime kanalına sinyal gönder
    supabase.channel('call-signal')
        .send({
            type: 'broadcast',
            event: 'call-signal',
            payload: {
                targetId: userId,
                senderId: currentUserId,
                signal: signal
            }
        });
}

// Gelen aramaları dinle
function listenForCalls() {
    // Realtime kanalına abone ol
    supabase.channel('call-signal')
        .on('broadcast', { event: 'call-signal' }, handleCallSignal)
        .subscribe();
}

// Arama sinyallerini işle
async function handleCallSignal(event) {
    const { senderId, targetId, signal } = event.payload;

    // Bana gönderilmediyse işlem yapma
    if (targetId !== currentUserId) return;

    console.log('Arama sinyali alındı:', signal.type);

    switch (signal.type) {
        case 'call-offer':
            handleIncomingCall(senderId, signal);
            break;

        case 'call-answer':
            handleCallAccepted(signal);
            break;

        case 'ice-candidate':
            handleNewICECandidate(signal);
            break;

        case 'call-end':
            handleRemoteCallEnd();
            break;

        case 'call-decline':
            handleCallDeclined();
            break;
    }
}

// Gelen arama işleme
async function handleIncomingCall(callerId, signal) {
    // Daha önceden aktif bir arama varsa reddet
    if (peerConnection) {
        sendCallSignal(callerId, {
            type: 'call-decline',
            reason: 'busy'
        });
        return;
    }

    try {
        const caller = signal.caller;

        // Kullanıcı medya erişimi iste
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Arama panelini göster
        const callPanelOverlay = document.querySelector('.call-panel-overlay');
        const incomingCallPanel = document.querySelector('.incoming-call');

        if (!callPanelOverlay || !incomingCallPanel) {
            console.error('Gelen arama panel elemanları bulunamadı');
            return;
        }

        // Paneli göster ve bilgileri doldur
        callPanelOverlay.style.display = 'flex';
        incomingCallPanel.style.display = 'flex';

        const callAvatar = incomingCallPanel.querySelector('.call-avatar');
        const callUsername = incomingCallPanel.querySelector('.call-username');

        if (callAvatar) callAvatar.src = caller.avatar || defaultAvatar;
        if (callUsername) callUsername.textContent = caller.username;

        // WebRTC bağlantısını başlat
        peerConnection = new RTCPeerConnection(servers);

        // ICE adaylarını dinle
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendCallSignal(callerId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        // Karşı taraftan ses gelince
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
        };

        // Yerel ses akışını bağlantıya ekle
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Gelen teklifi kaydet
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));

        // Aktif arama ID'sini kaydet
        activeCallUserId = callerId;

        // Bildirim sesi çal
        playCallSound();

        // 30 saniye sonra cevap yoksa aramayı otomatik reddet
        callTimeout = setTimeout(() => {
            if (incomingCallPanel.style.display !== 'none') {
                declineCall();
            }
        }, 30000);

    } catch (error) {
        console.error('Gelen arama işlenirken hata:', error);

        // Akışı kapat
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Aramayı reddet
        sendCallSignal(callerId, {
            type: 'call-decline',
            reason: 'error'
        });
    }
}

// Gelen aramayı kabul et
async function acceptCall() {
    if (!peerConnection || !activeCallUserId) return;

    try {
        // Timeout'u iptal et
        clearTimeout(callTimeout);

        // Cevap oluştur
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Cevabı gönder
        sendCallSignal(activeCallUserId, {
            type: 'call-answer',
            answer: answer
        });

        // Panelleri değiştir
        const incomingCallPanel = document.querySelector('.incoming-call');
        const activeCallPanel = document.querySelector('.active-call');

        if (incomingCallPanel) incomingCallPanel.style.display = 'none';
        if (activeCallPanel) {
            activeCallPanel.style.display = 'flex';

            // Kullanıcı bilgilerini güncelle
            const callAvatar = activeCallPanel.querySelector('.call-avatar');
            const callUsername = activeCallPanel.querySelector('.call-username');
            const callStatus = activeCallPanel.querySelector('.call-status');

            if (callAvatar) callAvatar.src = document.querySelector('.incoming-call .call-avatar').src;
            if (callUsername) callUsername.textContent = document.querySelector('.incoming-call .call-username').textContent;
            if (callStatus) callStatus.textContent = '00:00';
        }

        // Süre sayacını başlat
        startCallTimer();

        // Bildirim sesi durdur
        stopCallSound();

    } catch (error) {
        console.error('Arama kabul edilirken hata:', error);
        endCall();
    }
}

// Arama süresini gösteren sayaç
function startCallTimer() {
    callDuration = 0;
    const timerElement = document.querySelector('.active-call .call-status');

    callTimer = setInterval(() => {
        callDuration++;
        if (timerElement) {
            const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
            const seconds = (callDuration % 60).toString().padStart(2, '0');
            timerElement.textContent = `${minutes}:${seconds}`;
        }
    }, 1000);
}

// Arama kabul edildiğinde
async function handleCallAccepted(signal) {
    try {
        // Timeout'u iptal et
        clearTimeout(callTimeout);

        // Cevabı işle
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));

        // Panelleri değiştir
        const outgoingCallPanel = document.querySelector('.outgoing-call');
        const activeCallPanel = document.querySelector('.active-call');

        if (outgoingCallPanel) outgoingCallPanel.style.display = 'none';
        if (activeCallPanel) {
            activeCallPanel.style.display = 'flex';

            // Kullanıcı bilgilerini güncelle
            const callAvatar = activeCallPanel.querySelector('.call-avatar');
            const callUsername = activeCallPanel.querySelector('.call-username');
            const callStatus = activeCallPanel.querySelector('.call-status');

            if (callAvatar) callAvatar.src = document.querySelector('.outgoing-call .call-avatar').src;
            if (callUsername) callUsername.textContent = document.querySelector('.outgoing-call .call-username').textContent;
            if (callStatus) callStatus.textContent = '00:00';
        }

        // Süre sayacını başlat
        startCallTimer();

    } catch (error) {
        console.error('Arama cevabı işlenirken hata:', error);
        endCall();
    }
}

// ICE adayı geldiğinde
async function handleNewICECandidate(signal) {
    if (!peerConnection) return;

    try {
        await peerConnection.addIceCandidate(signal.candidate);
    } catch (error) {
        console.error('ICE adayı eklenirken hata:', error);
    }
}

// Giden aramayı iptal et
function cancelOutgoingCall() {
    if (!activeCallUserId) return;

    // Karşı tarafa arama bittiğini bildir
    sendCallSignal(activeCallUserId, {
        type: 'call-end'
    });

    // Aramayı temizle
    cleanupCall();
}

// Gelen aramayı reddet
function declineCall() {
    if (!activeCallUserId) return;

    // Karşı tarafa reddetme sinyali gönder
    sendCallSignal(activeCallUserId, {
        type: 'call-decline',
        reason: 'rejected'
    });

    // Aramayı temizle
    cleanupCall();

    // Bildirim sesi durdur
    stopCallSound();
}

// Aktif aramayı sonlandır
function endCall() {
    if (!activeCallUserId) return;

    // Karşı tarafa arama bittiğini bildir
    sendCallSignal(activeCallUserId, {
        type: 'call-end'
    });

    // Aramayı temizle
    cleanupCall();
}

// Karşı taraf aramayı sonlandırdığında
function handleRemoteCallEnd() {
    // Bildirim göster
    showNotification('Arama sonlandırıldı', 'info');

    // Aramayı temizle
    cleanupCall();
}

// Arama reddedildiğinde
function handleCallDeclined() {
    // Bildirim göster
    showNotification('Arama reddedildi', 'warning');

    // Aramayı temizle
    cleanupCall();
}

// Arama bilgilerini temizle
function cleanupCall() {
    // Timeout'u iptal et
    clearTimeout(callTimeout);

    // Süre sayacını durdur
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }

    // Arama panellerini gizle
    const callPanelOverlay = document.querySelector('.call-panel-overlay');
    const outgoingCallPanel = document.querySelector('.outgoing-call');
    const incomingCallPanel = document.querySelector('.incoming-call');
    const activeCallPanel = document.querySelector('.active-call');

    if (callPanelOverlay) callPanelOverlay.style.display = 'none';
    if (outgoingCallPanel) outgoingCallPanel.style.display = 'none';
    if (incomingCallPanel) incomingCallPanel.style.display = 'none';
    if (activeCallPanel) activeCallPanel.style.display = 'none';

    // Bağlantıyı kapat
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Medya akışlarını kapat
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    remoteStream = null;

    // Aktif arama ID'sini sıfırla
    activeCallUserId = null;

    // Mikrofon durumunu sıfırla
    isMuted = false;
    updateMuteButton();
}

// Mikrofon aç/kapat
function toggleMute() {
    if (!localStream) return;

    isMuted = !isMuted;

    // Mikrofon durumunu güncelle
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });

    updateMuteButton();
}

// Mikrofon butonunu güncelle
function updateMuteButton() {
    const muteBtn = document.querySelector('.active-call .mute-btn');
    if (!muteBtn) return;

    const muteIcon = muteBtn.querySelector('i');
    if (!muteIcon) return;

    if (isMuted) {
        muteBtn.classList.add('muted');
        muteIcon.className = 'fas fa-microphone-slash';
    } else {
        muteBtn.classList.remove('muted');
        muteIcon.className = 'fas fa-microphone';
    }
}

// Bildirim sesi çal
function playCallSound() {
    // Ses elementi ekle
    let callSound = document.getElementById('callSound');
    if (!callSound) {
        callSound = document.createElement('audio');
        callSound.id = 'callSound';
        callSound.src = 'sounds/call-ring.mp3'; // Ses dosyası konumu
        callSound.loop = true;
        document.body.appendChild(callSound);
    }

    callSound.play().catch(error => {
        console.warn('Ses çalınamadı:', error);
    });
}

// Bildirim sesini durdur
function stopCallSound() {
    const callSound = document.getElementById('callSound');
    if (callSound) {
        callSound.pause();
        callSound.currentTime = 0;
    }
}

// Bildirim göster
function showNotification(message, type = 'info') {
    // Mevcut bildirimler konteynerini bul veya oluştur
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
    }

    // Yeni bildirim elementi oluştur
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    // Bildirim içeriği
    const iconMap = {
        'success': 'fas fa-check-circle',
        'error': 'fas fa-exclamation-circle',
        'warning': 'fas fa-exclamation-triangle',
        'info': 'fas fa-info-circle'
    };

    notification.innerHTML = `
        <div class="notification-icon">
            <i class="${iconMap[type] || iconMap.info}"></i>
        </div>
        <div class="notification-content">${message}</div>
        <div class="notification-close">
            <i class="fas fa-times"></i>
        </div>
    `;

    // Konteyner'a ekle
    notificationContainer.appendChild(notification);

    // Animasyon için sınıf ekle
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Kapatma butonuna dinleyici ekle
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });
    }

    // Otomatik kapanma
    setTimeout(() => {
        closeNotification(notification);
    }, 5000);
}

// Bildirimi kapat
function closeNotification(notification) {
    notification.classList.remove('show');
    notification.classList.add('hide');

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

// Kullanıcı oturumu başlatılınca arama dinleyicisini de başlat
async function initializeUserSession({ userPanelUsernameElement, userPanelAvatarElement }) {
    try {
        // Oturum açmış kullanıcı bilgisini al
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
            console.error('Kullanıcı oturumu alınamadı:', userError);
            throw userError;
        }

        if (!user) {
            console.error('Kullanıcı bulunamadı - lütfen tekrar giriş yapın');
            showNotification('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');

            // Login sayfasına yönlendir
            window.location.href = 'login.html';
            return null;
        }

        currentUserId = user.id;
        console.log('Kullanıcı ID:', currentUserId);

        // Kullanıcı profil bilgilerini al veya oluştur
        const userProfile = await getOrCreateUserProfile(user);

        // UI güncelle
        updateUserInterface(userProfile, user, userPanelUsernameElement, userPanelAvatarElement);

        // Sesli aramalar için dinleyici başlat
        listenForCalls();

        return userProfile;
    } catch (error) {
        console.error('Kullanıcı oturumu sırasında hata:', error.message);
        showNotification('Oturum hatası: ' + error.message, 'error');
        throw error;
    }
}

// Kullanıcı profilini al veya oluştur
async function getOrCreateUserProfile(user) {
    try {
        // Profil bilgisini sorgula
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        // Profil varsa döndür
        if (profile) {
            console.log('Mevcut profil bulundu:', profile);
            return profile;
        }

        // Hata varsa kontrol et
        if (error) {
            console.warn('Profil sorgulanırken hata:', error);
        }

        // Profil yoksa oluştur
        console.log('Profil bulunamadı, RLS nedeniyle direk giriş yapıyoruz');

        // RLS nedeniyle profil oluşturamıyoruz - varsayılan profil döndür
        return {
            id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'Kullanıcı',
            created_at: new Date().toISOString()
        };
    } catch (error) {
        console.error('Profil işlemi hatası:', error);

        // Hata durumunda varsayılan profil
        return {
            id: user.id,
            username: user.user_metadata?.username || user.email?.split('@')[0] || 'Kullanıcı'
        };
    }
}

// Kullanıcı arayüzünü güncelle
function updateUserInterface(userProfile, user, userPanelUsernameElement, userPanelAvatarElement) {
    // Kullanıcı arayüz elementlerini güncelle
    if (userPanelUsernameElement) {
        userPanelUsernameElement.textContent = userProfile.username || user.user_metadata?.username || 'İsimsiz Kullanıcı';
    }

    if (userPanelAvatarElement) {
        userPanelAvatarElement.src = userProfile.avatar_url || defaultAvatar;
    }

    // Global değişkenleri güncelle - bu kolaylıkla erişilebilmesi için
    window.currentUserUsername = userProfile.username || user.user_metadata?.username;
    window.currentUserAvatar = userProfile.avatar_url || defaultAvatar;
}

// Sohbet arkadaşlarını yükleme fonksiyonu
async function loadFriends() {
    try {
        console.log('Arkadaşlar yükleniyor...');

        if (!currentUserId) {
            console.error('Arkadaşlar yüklenemedi: Kullanıcı kimliği bulunamadı');
            return;
        }

        // Basitleştirilmiş yöntem - doğrudan kullanıcıları yükle (ilişkisel tablo kullanmadan)
        const { data: users, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, status')
            .neq('id', currentUserId)  // Kendimiz dışında
            .limit(20); // İlk 20 kullanıcı

        // Tüm kullanıcıları temizle
        clearFriendsList();

        if (error) {
            console.error('Kullanıcılar yüklenirken hata:', error);
            showEmptyFriendsList();
            return;
        }

        if (!users || users.length === 0) {
            console.log('Kullanıcı bulunamadı');
            showEmptyFriendsList();
            return;
        }

        console.log('Kullanıcılar yüklendi:', users);

        // Arkadaşlar listesine ekle
        renderBasicFriendsList(users);
    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
        clearFriendsList();
    }
}

// Basit arkadaş listesi render et
function renderBasicFriendsList(users) {
    const friendsContainer = document.querySelector('#friends-group .dm-items');
    if (!friendsContainer) return;

    users.forEach(user => {
        const friendItem = document.createElement('div');
        friendItem.className = 'dm-item';
        friendItem.dataset.userId = user.id;

        friendItem.innerHTML = `
            <div class="dm-avatar">
                <img src="${user.avatar_url || defaultAvatar}" alt="${user.username}" onerror="this.src='${defaultAvatar}'">
                <div class="dm-status ${user.status || 'offline'}"></div>
            </div>
            <div class="dm-info">
                <div class="dm-name">${user.username}</div>
                <div class="dm-activity">${user.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
            </div>
        `;

        // Tıklama olayını ekle
        friendItem.addEventListener('click', () => {
            // Doğrudan kullanıcıya göre mesajlaşma
            openDirectChat(user.id, user.username, user.avatar_url);
        });

        friendsContainer.appendChild(friendItem);
    });
}

// Doğrudan chat (conversations tablosu olmadan)
function openDirectChat(userId, username, avatarUrl) {
    // Chat UI hazırla
    const chatPanel = document.querySelector('.chat-panel');
    if (chatPanel) {
        chatPanel.dataset.activeChatUserId = userId;
    }

    // Chat başlığını güncelle
    const chatUsername = document.querySelector('.chat-header-user .chat-username');
    const chatAvatar = document.querySelector('.chat-header-user .chat-avatar img');

    if (chatUsername) chatUsername.textContent = username;
    if (chatAvatar) chatAvatar.src = avatarUrl || defaultAvatar;

    // UI'da arkadaşı seçili olarak işaretle
    const allFriendItems = document.querySelectorAll('.dm-item');
    allFriendItems.forEach(item => item.classList.remove('active'));

    const selectedFriend = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
    if (selectedFriend) selectedFriend.classList.add('active');

    // Konuşmayı göster
    document.querySelector('.chat-container').style.display = 'flex';
    document.querySelector('.welcome-container').style.display = 'none';

    // Kullanıcılar arasındaki mesajları yükle
    loadDirectMessages(userId);

    console.log(`${username} ile sohbet açıldı`);
}

// Kullanıcılar arası mesajları yükle
async function loadDirectMessages(otherUserId) {
    if (!currentUserId || !otherUserId) {
        console.error('Mesajlar yüklenemedi: Kullanıcı ID bulunamadı');
        showEmptyMessages();
        return;
    }

    try {
        // Mesajlar tablosunda iki yönlü sorgula:
        // 1. Ben gönderici, diğer kişi alıcı
        // 2. Diğer kişi gönderici, ben alıcı
        const { data: messages, error } = await supabase
            .from('direct_messages')
            .select('*')
            .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Mesajlar alınırken hata:', error);
            showEmptyMessages();
            return;
        }

        // Mesajları göster
        renderDirectMessages(messages, otherUserId);

        // Realtime mesajları dinle
        subscribeToDirectMessages(otherUserId);

    } catch (error) {
        console.error('Mesajlar yüklenirken hata:', error);
        showEmptyMessages();
    }
}

// Boş mesaj durumu
function showEmptyMessages() {
    const messagesContainer = document.querySelector('.chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="chat-empty-state">
                <div class="chat-empty-icon"><i class="fas fa-comment-dots"></i></div>
                <div class="chat-empty-text">Henüz mesaj yok. Konuşmaya başlayın!</div>
            </div>
        `;
    }
}

// Direkt mesajları görüntüle
function renderDirectMessages(messages, otherUserId) {
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;

    // Mesajlar konteynerini temizle
    messagesContainer.innerHTML = '';

    if (!messages || messages.length === 0) {
        showEmptyMessages();
        return;
    }

    let lastMessageSender = null;
    let messageGroup = null;

    // Her mesajı ekle
    messages.forEach((message, index) => {
        const isOwnMessage = message.sender_id === currentUserId;

        // Aynı gönderenden arka arkaya gelen mesajları grupla
        if (lastMessageSender !== message.sender_id) {
            // Yeni grup başlat
            messageGroup = document.createElement('div');
            messageGroup.className = `chat-message-group ${isOwnMessage ? 'own-group' : ''}`;
            messagesContainer.appendChild(messageGroup);

            // İlk mesajı ekleyerek avatarı göster
            const firstMessageElem = createMessageElement(message, true, isOwnMessage);
            messageGroup.appendChild(firstMessageElem);

            lastMessageSender = message.sender_id;
        } else {
            // Aynı gruba devam
            const nextMessageElem = createMessageElement(message, false, isOwnMessage);
            messageGroup.appendChild(nextMessageElem);
        }
    });

    // Sohbet alanını en alta kaydır
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Mesaj elementi oluştur
function createMessageElement(message, showAvatar, isOwnMessage) {
    const messageElem = document.createElement('div');
    messageElem.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
    messageElem.dataset.messageId = message.id;

    // İçeriğin HTML mi yoksa plain text mi olduğunu belirle
    const content = message.is_gif || message.content.startsWith('<img')
        ? message.content // HTML içerik
        : escapeHtml(message.content); // Düz metin güvenli hale getir

    messageElem.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">${content}</div>
            <div class="message-time">${formatMessageTime(message.created_at)}</div>
        </div>
    `;

    return messageElem;
}

// HTML içeriğini escape et
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Realtime direkt mesajları dinle
function subscribeToDirectMessages(otherUserId) {
    // Önceki aboneliği iptal et
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }

    // Yeni abonelik oluştur
    messageSubscription = supabase
        .channel(`direct_messages`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `or(and(sender_id=eq.${currentUserId},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${currentUserId}))`
        }, handleNewDirectMessage)
        .subscribe();

    console.log(`${otherUserId} ile mesajlaşma için realtime dinleme başlatıldı`);
}

// Yeni direkt mesaj geldiğinde
function handleNewDirectMessage(payload) {
    console.log('Yeni direkt mesaj alındı:', payload);

    // Aktif sohbet var mı?
    const activeUserId = document.querySelector('.chat-panel').dataset.activeChatUserId;
    if (!activeUserId) return;

    // Mesajları yeniden yükle
    loadDirectMessages(activeUserId);

    // Ben göndermedim ve aktif kullanıcıdan geldiyse
    if (payload.new && payload.new.sender_id !== currentUserId) {
        // Bildirim sesi çal
        if (messageNotificationSound) {
            messageNotificationSound.play().catch(err => console.warn('Bildirim sesi çalınamadı:', err));
        }
    }
}

// Direk mesaj gönder
async function sendDirectMessage(receiverId, content, isGif = false) {
    if (!currentUserId || !receiverId) {
        showNotification('Mesaj göndermek için geçerli bir alıcı seçmelisiniz', 'warning');
        return;
    }

    try {
        // Mesajı veritabanına ekle
        const { data, error } = await supabase
            .from('direct_messages')
            .insert([
                {
                    sender_id: currentUserId,
                    receiver_id: receiverId,
                    content: content,
                    is_gif: isGif,
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Mesaj gönderilirken hata:', error);
            showNotification('Mesaj gönderilemedi', 'error');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Mesaj gönderme hatası:', error);
        showNotification('Mesaj gönderilemedi: ' + error.message, 'error');
        return false;
    }
}

// Mesaj göndermeyi yönet
async function handleSendMessage(event) {
    event.preventDefault();

    // Aktif sohbet kullanıcısını al
    const receiverId = document.querySelector('.chat-panel').dataset.activeChatUserId;

    if (!receiverId) {
        showNotification('Mesaj göndermek için önce bir sohbet seçmelisiniz', 'warning');
        return;
    }

    // Mesaj içeriğini al
    const messageInput = document.querySelector('.message-input');
    const content = messageInput.value.trim();

    if (!content) return;

    // Mesajı gönder
    const success = await sendDirectMessage(receiverId, content);

    if (success) {
        // Formu temizle
        messageInput.value = '';
    }
}

// Bildirim sesi yükle
function loadNotificationSound() {
    try {
        // Ses nesnesini oluştur
        messageNotificationSound = new Audio('sounds/notification.mp3');
        messageNotificationSound.volume = 0.5;
        console.log('Bildirim sesi başarıyla yüklendi');
    } catch (error) {
        console.error('Bildirim sesi yüklenemedi:', error);
    }
}

// Realtime Presence kanalına abone ol
function subscribeToPresence() {
    try {
        if (!currentUserId) {
            console.error('Presence kanalına abone olunamadı: Kullanıcı kimliği bulunamadı');
            return;
        }

        console.log('Presence kanalına abone olunuyor...');

        // Realtime presence kanalı için
        presenceChannel = supabase.channel('online-users', {
            config: {
                presence: {
                    key: currentUserId
                }
            }
        });

        // Presence olaylarını dinle
        presenceChannel
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('Kullanıcılar çevrimiçi oldu:', newPresences);

                // Yeni çevrimiçi kullanıcıları işle
                newPresences.forEach(presence => {
                    // Kendi ID'miz değilse ekle
                    if (presence.user_id !== currentUserId) {
                        onlineFriends.add(presence.user_id);
                        updateFriendStatus(presence.user_id, 'online');
                    }
                });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('Kullanıcılar çevrimdışı oldu:', leftPresences);

                // Çevrimdışı olan kullanıcıları işle
                leftPresences.forEach(presence => {
                    onlineFriends.delete(presence.user_id);
                    updateFriendStatus(presence.user_id, 'offline');
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Kendi durumumuzu gönder
                    await presenceChannel.track({
                        user_id: currentUserId,
                        username: window.currentUserUsername,
                        online_at: new Date().toISOString()
                    });

                    console.log('Presence kanalına başarıyla abone olundu');
                }
            });

    } catch (error) {
        console.error('Presence kanalına abone olunurken hata:', error);
    }
}

// Arkadaşın çevrimiçi durumunu güncelle
function updateFriendStatus(userId, status) {
    const friendItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
    if (!friendItem) return;

    const statusElement = friendItem.querySelector('.dm-status');
    const activityElement = friendItem.querySelector('.dm-activity');

    if (statusElement) {
        statusElement.className = `dm-status ${status}`;
    }

    if (activityElement) {
        activityElement.textContent = status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı';
    }
}

// Sohbet paneline olayları ekle
function addChatEventListeners() {
    try {
        console.log('Sohbet olay dinleyicileri ekleniyor...');

        // Çıkış butonu
        const logoutBtn = document.querySelector('.logout-icon');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        // Mesaj gönderme formu
        const messageForm = document.querySelector('.message-input-form');
        if (messageForm) {
            messageForm.addEventListener('submit', handleSendMessage);
        }

        // GIF butonları
        const gifButton = document.querySelector('.chat-action-btn[title="GIF"]');
        if (gifButton) {
            gifButton.addEventListener('click', toggleGifPanel);
        }

        console.log('Sohbet olay dinleyicileri başarıyla eklendi');
    } catch (error) {
        console.error('Sohbet olay dinleyicileri eklenirken hata:', error);
    }
}

// Çıkış işlemini yönet
async function handleLogout() {
    try {
        // Oturumu kapat
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        // Ana sayfaya yönlendir
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Çıkış yapılırken hata:', error);
        showNotification('Çıkış yapılamadı: ' + error.message, 'error');
    }
}

// GIF panelini aç/kapat
function toggleGifPanel() {
    const gifPanel = document.querySelector('.gif-panel');

    if (!gifPanel) {
        // Panel yoksa oluştur
        createGifPanel();
    } else {
        // Panel varsa aç/kapat
        gifPanel.style.display = gifPanel.style.display === 'none' ? 'block' : 'none';
    }
}

// GIF paneli oluştur
function createGifPanel() {
    // Panel container oluştur
    const gifPanel = document.createElement('div');
    gifPanel.className = 'gif-panel';

    // Panel içeriği
    gifPanel.innerHTML = `
        <div class="gif-header">
            <div class="gif-search">
                <input type="text" placeholder="GIF Ara..." class="gif-search-input">
                <button class="gif-search-btn"><i class="fas fa-search"></i></button>
            </div>
            <button class="gif-close-btn"><i class="fas fa-times"></i></button>
        </div>
        <div class="gif-content">
            <div class="gif-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>GIFler yükleniyor...</span>
            </div>
            <div class="gif-results"></div>
        </div>
    `;

    // Chat giriş alanının üzerine ekle
    const messageInput = document.querySelector('.message-input-container');
    messageInput.appendChild(gifPanel);

    // Kapatma butonu olayı
    const closeBtn = gifPanel.querySelector('.gif-close-btn');
    closeBtn.addEventListener('click', () => {
        gifPanel.style.display = 'none';
    });

    // Arama olayı
    const searchInput = gifPanel.querySelector('.gif-search-input');
    const searchBtn = gifPanel.querySelector('.gif-search-btn');

    searchBtn.addEventListener('click', () => {
        searchGifs(searchInput.value.trim());
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchGifs(searchInput.value.trim());
        }
    });

    // Varsayılan GIFler yükle
    searchGifs('hello');
}

// GIF arama
async function searchGifs(query) {
    if (!query) return;

    const resultsContainer = document.querySelector('.gif-results');
    const loadingIndicator = document.querySelector('.gif-loading');

    if (!resultsContainer || !loadingIndicator) return;

    // Yükleme göster
    loadingIndicator.style.display = 'flex';
    resultsContainer.innerHTML = '';

    try {
        // Tenor API'ye istek
        const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20`);
        const data = await response.json();

        // Sonuçları göster
        loadingIndicator.style.display = 'none';

        if (!data.results || data.results.length === 0) {
            resultsContainer.innerHTML = '<div class="gif-empty">Sonuç bulunamadı</div>';
            return;
        }

        // GIFleri ekle
        data.results.forEach(gif => {
            const gifElement = document.createElement('div');
            gifElement.className = 'gif-item';

            const mediaFormats = gif.media_formats;
            const gifUrl = mediaFormats.gif?.url || mediaFormats.tinygif?.url || gif.url;

            gifElement.innerHTML = `<img src="${gifUrl}" alt="${gif.content_description || 'GIF'}" loading="lazy">`;

            // GIF'e tıklandığında
            gifElement.addEventListener('click', () => {
                sendGifMessage(gifUrl);
                document.querySelector('.gif-panel').style.display = 'none';
            });

            resultsContainer.appendChild(gifElement);
        });

    } catch (error) {
        console.error('GIF arama hatası:', error);
        loadingIndicator.style.display = 'none';
        resultsContainer.innerHTML = '<div class="gif-error">GIF yüklenemedi</div>';
    }
}

// GIF mesajı gönder
async function sendGifMessage(gifUrl) {
    // Aktif sohbet kullanıcısını al
    const receiverId = document.querySelector('.chat-panel').dataset.activeChatUserId;

    if (!receiverId) {
        showNotification('GIF göndermek için önce bir sohbet seçmelisiniz', 'warning');
        return;
    }

    // GIF mesajını gönder
    const content = `<img src="${gifUrl}" alt="GIF" class="message-gif">`;
    await sendDirectMessage(receiverId, content, true);
}

