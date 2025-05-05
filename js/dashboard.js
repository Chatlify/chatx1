import { supabase } from './auth_config.js'; // Supabase istemcisini import et

// Global değişkenler tanımları
let currentUserId = null;
let onlineFriends = new Set();
let presenceChannel = null;
let currentConversationId = null; // Aktif sohbet için ID
let messageSubscription = null; // Realtime mesaj aboneliği
let sampleColumnFormat = 'camelCase'; // Varsayılan olarak camelCase formatını kullan
const defaultAvatar = 'images/logo.svg'; // Varsayılan avatar yolunu logo.svg olarak güncelledim
let messageNotificationSound = null; // Ses nesnesi için global değişken
let unreadCounts = {}; // Okunmamış mesaj sayaçları { userId: count }

// Tenor API anahtarı - GIF özelliği test amaçlı devre dışı
// İdealde bu anahtar backend üzerinden veya güvenli bir yapılandırma ile yönetilmelidir.
const TENOR_API_KEY = null; // GIF özelliğini geçici olarak devre dışı bırakıyoruz

// API anahtarı kontrolü
if (!TENOR_API_KEY) {
    console.log('Tenor API GIF özelliği test amaçlı olarak devre dışı bırakılmıştır.');
    // Konsol hata mesajını kaldırdık, kullanıcı deneyimini etkilememesi için
}

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

    // ... existing code ...

    // Sohbet başlığındaki sesli arama butonunu bul ve işlev ekle
    const voiceCallBtn = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', handleVoiceCallButtonClick);
    }

    // Arama paneli butonlarını ayarla
    setupCallPanelButtons();

    // Kullanıcı paneli elementlerini seç
    const userPanelUsernameElement = document.querySelector('.dm-user-name');
    const userPanelAvatarElement = document.querySelector('.dm-user-avatar img');

    // Kullanıcı oturumunu başlat
    await initializeUserSession({
        userPanelUsernameElement,
        userPanelAvatarElement
    });

    // Chat başlatma fonksiyonu
    function startChat(userId, username, avatarUrl) {
        console.log(`${username} ile sohbet başlatılıyor...`);
        // Sohbet panelini göster ve kullanıcı bilgilerini ayarla
        showChatPanel(userId, username, avatarUrl);
    }

    // ... existing code ...
});

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
        // Mevcut oturumu kontrol et
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Oturum bilgisi alınamadı:', error.message);
            window.location.href = 'login.html';
            return;
        }

        if (!session) {
            console.log('Aktif oturum bulunamadı, giriş sayfasına yönlendiriliyor...');
            window.location.href = 'login.html';
            return;
        }

        // Kullanıcı bilgilerini al
        currentUserId = session.user.id;

        // Kullanıcı profilini getir
        const { data: userProfile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUserId)
            .single();

        if (profileError) {
            console.error('Kullanıcı profili alınamadı:', profileError.message);
        }

        // Kullanıcı bilgilerini panel'e yükle
        if (userProfile) {
            // Kullanıcı adını güncelle
            if (userPanelUsernameElement) {
                userPanelUsernameElement.textContent = userProfile.username || 'Kullanıcı';
            }

            // Avatar'ı güncelle
            if (userPanelAvatarElement && userProfile.avatar_url) {
                userPanelAvatarElement.src = userProfile.avatar_url;
            }

            // Global değişkenlere kaydet
            window.currentUserUsername = userProfile.username;
            window.currentUserAvatar = userProfile.avatar_url;
        }

        // Arkadaş listesini yükle
        await loadFriends();

        // Çevrimiçi durumlarını takip et
        setupPresenceChannel();

        // Sesli aramalar için dinleyici başlat
        listenForCalls();

        console.log('Kullanıcı oturumu başarıyla başlatıldı:', currentUserId);
    } catch (error) {
        console.error('Kullanıcı oturumu başlatılırken hata:', error.message);
    }
}

// Arkadaş listesini yükle
async function loadFriends() {
    try {
        // Arkadaşları getir
        const { data: friends, error } = await supabase
            .from('friends')
            .select('*')
            .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
            .eq('status', 'accepted');

        if (error) {
            console.error('Arkadaş listesi yüklenirken hata:', error.message);
            return;
        }

        // Arkadaş listesi boşsa
        if (!friends || friends.length === 0) {
            console.log('Arkadaş listeniz boş.');
            // Boş liste göster
            return;
        }

        // Arkadaş ID'lerini al
        const friendIds = friends.map(friendship =>
            friendship.user_id === currentUserId ? friendship.friend_id : friendship.user_id
        );

        // Arkadaşların profillerini getir
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', friendIds);

        if (profilesError) {
            console.error('Arkadaş profilleri yüklenirken hata:', profilesError.message);
            return;
        }

        // Arkadaş listesini DOM'a ekle
        renderFriendsList(profiles);

    } catch (error) {
        console.error('Arkadaşlar yüklenirken beklenmeyen hata:', error.message);
    }
}

// Arkadaş listesini DOM'a renderla
function renderFriendsList(friendProfiles) {
    const friendsContainer = document.querySelector('#friends-group .dm-items');
    if (!friendsContainer) return;

    // Mevcut içeriği temizle
    friendsContainer.innerHTML = '';

    // Arkadaş yoksa
    if (!friendProfiles || friendProfiles.length === 0) {
        friendsContainer.innerHTML = '<div class="empty-message">Henüz arkadaşınız yok</div>';
        return;
    }

    // Her arkadaş için bir öğe oluştur
    friendProfiles.forEach(profile => {
        const isOnline = onlineFriends.has(profile.id);

        const friendItem = document.createElement('div');
        friendItem.className = 'dm-item';
        friendItem.dataset.userId = profile.id;

        friendItem.innerHTML = `
            <div class="dm-avatar">
                <img src="${profile.avatar_url || defaultAvatar}" alt="${profile.username}">
                <div class="dm-status ${isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="dm-info">
                <div class="dm-name">${profile.username}</div>
                <div class="dm-activity">${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
            </div>
        `;

        // Arkadaşa tıklama olayı ekle
        friendItem.addEventListener('click', () => {
            startChat(profile.id, profile.username, profile.avatar_url);
        });

        friendsContainer.appendChild(friendItem);
    });
}

// Çevrimiçi durumlarını takip et
function setupPresenceChannel() {
    presenceChannel = supabase.channel('online-users')
        .on('presence', { event: 'sync' }, () => {
            const newState = presenceChannel.presenceState();

            // Çevrimiçi kullanıcıları güncelle
            onlineFriends.clear();

            Object.keys(newState).forEach(userId => {
                if (userId !== currentUserId) {
                    onlineFriends.add(userId);
                }
            });

            // Arkadaş listesini güncelle
            updateOnlineStatus();
        })
        .on('presence', { event: 'join' }, ({ key }) => {
            if (key !== currentUserId) {
                onlineFriends.add(key);
                updateOnlineStatus();
            }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
            if (key !== currentUserId) {
                onlineFriends.delete(key);
                updateOnlineStatus();
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({
                    user_id: currentUserId,
                    online_at: new Date().toISOString()
                });
            }
        });
}

// Çevrimiçi durumlarını güncelle
function updateOnlineStatus() {
    const friendItems = document.querySelectorAll('.dm-item[data-user-id]');

    friendItems.forEach(item => {
        const userId = item.dataset.userId;
        const isOnline = onlineFriends.has(userId);

        const statusDot = item.querySelector('.dm-status');
        const activityText = item.querySelector('.dm-activity');

        if (statusDot) {
            statusDot.className = `dm-status ${isOnline ? 'online' : 'offline'}`;
        }

        if (activityText) {
            activityText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
        }
    });
}

// Sohbet panelini göster
function showChatPanel(userId, username, avatarUrl) {
    const chatPanel = document.querySelector('.chat-panel');
    if (!chatPanel) {
        console.error('Sohbet paneli bulunamadı');
        return;
    }

    // Panel'i görünür yap
    chatPanel.classList.remove('hidden');
    chatPanel.dataset.activeChatUserId = userId;

    // Kullanıcı bilgileri
    const chatHeaderUser = chatPanel.querySelector('.chat-header-user');
    const chatUsername = chatPanel.querySelector('.chat-username');
    const chatAvatar = chatPanel.querySelector('.chat-avatar img');

    if (chatUsername) chatUsername.textContent = username;
    if (chatAvatar) chatAvatar.src = avatarUrl || defaultAvatar;

    // Mesajları yükle
    loadMessages(userId);

    // Mesaj aboneliğini ayarla
    setupMessageSubscription(userId);

    // Dashboard container'a chat-open sınıfı ekle (mobil görünüm için)
    document.querySelector('.dashboard-container').classList.add('chat-open');
}

// Sohbet mesajlarını yükle
async function loadMessages(userId) {
    if (!userId || !currentUserId) return;

    try {
        // Konuşmayı bul veya oluştur
        currentConversationId = await getOrCreateConversation(userId);

        if (!currentConversationId) {
            console.error('Konuşma ID alınamadı');
            return;
        }

        // Mesajları getir
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', currentConversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Mesajlar yüklenirken hata:', error.message);
            return;
        }

        // Mesajları ekrana yükle
        renderMessages(messages);

        // Mesajları okundu olarak işaretle
        markMessagesAsRead(userId);

    } catch (error) {
        console.error('Mesajlar yüklenirken beklenmeyen hata:', error.message);
    }
}

// Konuşma ID'sini getir veya oluştur
async function getOrCreateConversation(userId) {
    if (!userId || !currentUserId) return null;

    try {
        // Mevcut konuşmayı ara
        const { data: conversations, error } = await supabase
            .from('conversations')
            .select('id')
            .or(`(user1_id.eq.${currentUserId}).and(user2_id.eq.${userId}),(user1_id.eq.${userId}).and(user2_id.eq.${currentUserId})`)
            .limit(1);

        if (error) {
            console.error('Konuşma aranırken hata:', error.message);
            return null;
        }

        // Konuşma zaten varsa, ID'sini döndür
        if (conversations && conversations.length > 0) {
            return conversations[0].id;
        }

        // Konuşma yoksa yeni oluştur
        const { data: newConversation, error: createError } = await supabase
            .from('conversations')
            .insert([
                { user1_id: currentUserId, user2_id: userId }
            ])
            .select('id')
            .single();

        if (createError) {
            console.error('Konuşma oluşturulurken hata:', createError.message);
            return null;
        }

        return newConversation.id;

    } catch (error) {
        console.error('Konuşma işlenirken beklenmeyen hata:', error.message);
        return null;
    }
}

// Mesajları ekrana renderla
function renderMessages(messages) {
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;

    // Mevcut içeriği temizle
    messagesContainer.innerHTML = '';

    // Mesaj yoksa
    if (!messages || messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="chat-empty-state">
                <div class="empty-icon"><i class="fas fa-comments"></i></div>
                <div class="empty-text">Henüz mesaj yok. Sohbete başlamak için mesaj gönder!</div>
            </div>
        `;
        return;
    }

    // Mesajları grupla
    const messageGroups = groupMessagesByUser(messages);

    // Her grup için bir message-group oluştur
    messageGroups.forEach(group => {
        const isOwnMessage = group.sender_id === currentUserId;

        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isOwnMessage ? 'own-message' : ''}`;

        // Message group içeriği
        let groupHtml = `
            <div class="message-group-avatar">
                <img src="${group.avatar || defaultAvatar}" alt="${group.username}">
            </div>
            <div class="message-group-content">
                <div class="message-group-header">
                    <div class="message-author">${isOwnMessage ? 'Sen' : group.username}</div>
                    <div class="message-time">${formatDate(group.messages[0].created_at)}</div>
                </div>
        `;

        // Gruptaki her mesaj için
        group.messages.forEach(message => {
            if (message.content) {
                groupHtml += `<div class="message-content"><p>${escapeHtml(message.content)}</p></div>`;
            }
            // Medya ve diğer mesaj türleri burada eklenebilir
        });

        groupHtml += '</div>';
        messageGroup.innerHTML = groupHtml;

        messagesContainer.appendChild(messageGroup);
    });

    // Sohbet alanını aşağı kaydır
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Mesajları kullanıcıya göre grupla
function groupMessagesByUser(messages) {
    const groups = [];
    let currentGroup = null;

    messages.forEach(message => {
        // Yeni grup başlatılması gerekiyor mu?
        if (!currentGroup || currentGroup.sender_id !== message.sender_id) {
            // Eğer önceki grup varsa, onu groups dizisine ekle
            if (currentGroup) {
                groups.push(currentGroup);
            }

            // Yeni grup oluştur
            currentGroup = {
                sender_id: message.sender_id,
                username: message.sender_username || 'Kullanıcı',
                avatar: message.sender_avatar || defaultAvatar,
                messages: [message]
            };
        } else {
            // Mevcut gruba mesajı ekle
            currentGroup.messages.push(message);
        }
    });

    // Son grubu da ekle
    if (currentGroup) {
        groups.push(currentGroup);
    }

    return groups;
}

// Tarih/saat formatı
function formatDate(dateString) {
    const date = new Date(dateString);

    // Bugün için sadece saat göster
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    if (isToday) {
        return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }

    // Dün için "Dün" göster
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
        return `Dün ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Diğer günler için tarih ve saat göster
    return date.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// HTML özel karakterleri escape et
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Mesajları okundu olarak işaretle
async function markMessagesAsRead(userId) {
    if (!userId || !currentUserId) return;

    try {
        // Okunmamış mesajları bul
        const { data: unreadMessages, error } = await supabase
            .from('messages')
            .select('id')
            .eq('receiver_id', currentUserId)
            .eq('sender_id', userId)
            .eq('is_read', false);

        if (error) {
            console.error('Okunmamış mesajlar alınırken hata:', error.message);
            return;
        }

        if (!unreadMessages || unreadMessages.length === 0) {
            return;
        }

        // Mesaj ID'lerini al
        const messageIds = unreadMessages.map(msg => msg.id);

        // Mesajları okundu olarak güncelle
        const { error: updateError } = await supabase
            .from('messages')
            .update({ is_read: true })
            .in('id', messageIds);

        if (updateError) {
            console.error('Mesajlar okundu olarak işaretlenirken hata:', updateError.message);
        }

        // Okunmamış mesaj sayacını sıfırla
        if (unreadCounts[userId]) {
            unreadCounts[userId] = 0;
            updateUnreadIndicator(userId);
        }

    } catch (error) {
        console.error('Mesajları okundu olarak işaretlerken beklenmeyen hata:', error.message);
    }
}

// Mesaj aboneliğini ayarla
function setupMessageSubscription(userId) {
    // Önceki aboneliği temizle
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }

    if (!userId || !currentUserId) return;

    // Realtime aboneliği oluştur
    messageSubscription = supabase
        .channel('messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${currentConversationId}`
        }, handleNewMessage)
        .subscribe();
}

// Yeni mesaj geldiğinde
function handleNewMessage(payload) {
    // Yeni mesajı al
    const newMessage = payload.new;

    // Mesajları güncelle
    appendNewMessage(newMessage);

    // Mesaj gönderen kişi karşı tarafsa, okundu olarak işaretle
    if (newMessage.sender_id !== currentUserId) {
        markMessageAsRead(newMessage.id);
    }

    // Bildirim sesi çal
    playMessageSound();
}

// Yeni mesajı mevcut sohbete ekle
function appendNewMessage(message) {
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;

    const isOwnMessage = message.sender_id === currentUserId;

    // Son message-group'u bul
    const lastGroup = messagesContainer.querySelector('.message-group:last-child');

    // Son grup aynı gönderene aitse, gruba ekle
    if (lastGroup &&
        ((isOwnMessage && lastGroup.classList.contains('own-message')) ||
            (!isOwnMessage && !lastGroup.classList.contains('own-message')))) {

        // Son gruba mesajı ekle
        const groupContent = lastGroup.querySelector('.message-group-content');
        if (groupContent && message.content) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-content';
            messageDiv.innerHTML = `<p>${escapeHtml(message.content)}</p>`;
            groupContent.appendChild(messageDiv);
        }

    } else {
        // Yeni grup oluştur
        const messageGroup = document.createElement('div');
        messageGroup.className = `message-group ${isOwnMessage ? 'own-message' : ''}`;

        messageGroup.innerHTML = `
            <div class="message-group-avatar">
                <img src="${message.sender_avatar || defaultAvatar}" alt="${message.sender_username || 'Kullanıcı'}">
            </div>
            <div class="message-group-content">
                <div class="message-group-header">
                    <div class="message-author">${isOwnMessage ? 'Sen' : (message.sender_username || 'Kullanıcı')}</div>
                    <div class="message-time">${formatDate(message.created_at)}</div>
                </div>
                <div class="message-content">
                    <p>${escapeHtml(message.content)}</p>
                </div>
            </div>
        `;

        messagesContainer.appendChild(messageGroup);
    }

    // Sohbet alanını aşağı kaydır
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Mesajı okundu olarak işaretle
async function markMessageAsRead(messageId) {
    try {
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', messageId);

        if (error) {
            console.error('Mesaj okundu olarak işaretlenirken hata:', error.message);
        }

    } catch (error) {
        console.error('Mesaj okundu olarak işaretlenirken beklenmeyen hata:', error.message);
    }
}

// Bildirim sesini çal
function playMessageSound() {
    // Çalışan bir sohbet varsa ve mesaj sesi yoksa oluştur
    if (!messageNotificationSound) {
        messageNotificationSound = new Audio('sounds/message.mp3');
    }

    messageNotificationSound.currentTime = 0;
    messageNotificationSound.play().catch(err => {
        console.warn('Bildirim sesi çalınamadı:', err);
    });
}

// Okunmamış mesaj göstergesini güncelle
function updateUnreadIndicator(userId) {
    if (!userId) return;

    // DM öğesini bul
    const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
    if (!dmItem) return;

    // Bildirim badge'ini bul veya oluştur
    let badge = dmItem.querySelector('.dm-notification');

    // Okunmamış mesaj sayısı varsa
    if (unreadCounts[userId] && unreadCounts[userId] > 0) {
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'dm-notification';
            dmItem.appendChild(badge);
        }

        badge.textContent = unreadCounts[userId] > 99 ? '99+' : unreadCounts[userId];
        badge.style.display = 'flex';
    } else if (badge) {
        // Okunmamış mesaj yoksa badge'i gizle
        badge.style.display = 'none';
    }
}

