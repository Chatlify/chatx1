import { supabase } from './auth_config.js'; // Supabase istemcisini import et

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
let currentUserUsername = null; // Geçerli kullanıcı adı
let currentUserAvatar = null; // Geçerli kullanıcı avatarı

// Tenor API anahtarını doğrudan tanımla
// DİKKAT: API anahtarını doğrudan istemci koduna yazmak güvenlik riski taşır.
// İdealde bu anahtar backend üzerinden veya güvenli bir yapılandırma ile yönetilmelidir.
const TENOR_API_KEY = "AIzaSyDPnxM8Vt7_jtC0ALJUqvmLV0Nt4oYTNO8"; // Tenor API key düzeltildi

// API anahtarı kontrolü
if (!TENOR_API_KEY || TENOR_API_KEY === "YOUR_TENOR_API_KEY") {
    console.error('Tenor API anahtarı bulunamadı veya güncellenmemiş! GIF özellikleri çalışmayabilir. Lütfen js/dashboard.js dosyasını kontrol edin.');
    // alert("Tenor API anahtarı eksik. GIF özellikleri kullanılamayacak.");
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

    // Kullanıcı oturumunu başlat
    const userPanel = document.querySelector('.dm-user');
    if (userPanel) {
        initializeUserSession({
            userPanelUsernameElement: userPanel.querySelector('.dm-user-name'),
            userPanelAvatarElement: userPanel.querySelector('.dm-user-avatar img')
        });
    } else {
        console.error('Kullanıcı paneli bulunamadı');
    }

    // Sohbet başlığındaki sesli arama butonunu bul ve işlev ekle
    const voiceCallBtn = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', handleVoiceCallButtonClick);
    }

    // Arama paneli butonlarını ayarla
    setupCallPanelButtons();

    // Mesaj gönderme butonunu aktifleştir
    const sendButton = document.querySelector('.chat-send-btn');
    const messageInput = document.querySelector('.chat-textbox textarea');

    if (sendButton && messageInput) {
        // Mesaj gönderme butonu tıklandığında
        sendButton.addEventListener('click', () => sendMessage(messageInput));

        // Enter tuşuna basıldığında
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(messageInput);
            }
        });
    }

    // Sohbet kapatma butonunu aktifleştir
    const closeButton = document.querySelector('.chat-close-btn');
    if (closeButton) {
        closeButton.addEventListener('click', closeChatPanel);
    }

    // Çıkış butonunu aktifleştir
    const logoutButton = document.querySelector('.logout-icon');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
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
        console.log('Kullanıcı oturumu başlatılıyor...');

        // Mevcut oturum bilgisini al
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Oturum bilgisi alınamadı:', error.message);
            return;
        }

        if (!session) {
            console.error('Aktif oturum bulunamadı');
            // Ana sayfaya yönlendir
            window.location.href = 'login.html';
            return;
        }

        // Kullanıcı ID'sini kaydet
        currentUserId = session.user.id;

        console.log('Kullanıcı kimliği:', currentUserId);

        // Kullanıcı profilini getir
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUserId)
            .single();

        if (profileError) {
            console.error('Profil bilgisi alınamadı:', profileError.message);
        } else if (profile) {
            // Kullanıcı bilgilerini global değişkenlere kaydet
            currentUserUsername = profile.username || 'Kullanıcı';
            currentUserAvatar = profile.avatar_url || defaultAvatar;

            // UI elemanlarını güncelle
            if (userPanelUsernameElement) {
                userPanelUsernameElement.textContent = profile.username || 'Kullanıcı';
            }

            if (userPanelAvatarElement) {
                userPanelAvatarElement.src = profile.avatar_url || defaultAvatar;
            }
        }

        // Arkadaş listesini yükle
        await loadFriends();

        // Sesli aramalar için dinleyici başlat
        listenForCalls();

        console.log('Kullanıcı oturumu başarıyla başlatıldı');

    } catch (error) {
        console.error('Kullanıcı oturumu başlatılırken hata:', error);
    }
}

// Arkadaş listesini yükle
async function loadFriends() {
    try {
        console.log('Arkadaş listesi yükleniyor...');

        // Şimdilik sabit arkadaş listesi kullan (gerçek uygulama için veritabanından çekilmeli)
        const fakeFriends = [
            {
                id: '1',
                username: 'Ahmet Yılmaz',
                avatar_url: 'https://via.placeholder.com/100/3498db/ffffff?text=A',
                status: 'online'
            },
            {
                id: '2',
                username: 'Mehmet Demir',
                avatar_url: 'https://via.placeholder.com/100/2ecc71/ffffff?text=M',
                status: 'offline'
            },
            {
                id: '3',
                username: 'Ayşe Kaya',
                avatar_url: 'https://via.placeholder.com/100/e74c3c/ffffff?text=A',
                status: 'online'
            }
        ];

        // Çevrimiçi arkadaşları ayarla
        fakeFriends.forEach(friend => {
            if (friend.status === 'online') {
                onlineFriends.add(friend.id);
            }
        });

        // Arkadaş listesini UI'a ekle
        displayFriends(fakeFriends);

        console.log('Arkadaş listesi başarıyla yüklendi');

    } catch (error) {
        console.error('Arkadaşlar yüklenirken hata:', error);
    }
}

// Arkadaş listesini UI'da göster
function displayFriends(friends) {
    const friendsContainer = document.querySelector('#friends-group .dm-items');
    if (!friendsContainer) return;

    // Konteynerı temizle
    friendsContainer.innerHTML = '';

    if (friends.length === 0) {
        friendsContainer.innerHTML = `
            <div class="empty-friends-message">
                <p>Henüz arkadaş eklenmemiş</p>
            </div>
        `;
        return;
    }

    // Her arkadaş için UI elementi oluştur
    friends.forEach(friend => {
        const friendElement = document.createElement('div');
        friendElement.className = 'dm-item';
        friendElement.dataset.userId = friend.id;

        // Çevrimiçi arkadaşları işaretle
        if (onlineFriends.has(friend.id)) {
            friendElement.classList.add('online');
        }

        friendElement.innerHTML = `
            <div class="dm-avatar">
                <img src="${friend.avatar_url || defaultAvatar}" alt="${friend.username}">
                <div class="dm-status ${onlineFriends.has(friend.id) ? 'online' : 'offline'}"></div>
            </div>
            <div class="dm-info">
                <div class="dm-name">${friend.username || 'Kullanıcı'}</div>
                <div class="dm-activity">${onlineFriends.has(friend.id) ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
            </div>
        `;

        // Tıklama olayını ekle - mesajlaşma panelini aç
        friendElement.addEventListener('click', () => {
            openChatWithUser(friend.id, friend.username, friend.avatar_url);
        });

        friendsContainer.appendChild(friendElement);
    });
}

// Kullanıcı ile sohbet panelini aç
function openChatWithUser(userId, username, avatar) {
    console.log(`${username} ile sohbet açılıyor...`);

    // Sohbet panelini bul
    const chatPanel = document.querySelector('.chat-panel');
    if (!chatPanel) return;

    // Paneli görünür yap
    chatPanel.classList.remove('hidden');
    document.querySelector('.dashboard-container').classList.add('chat-open');

    // Kullanıcı bilgilerini ayarla
    chatPanel.dataset.activeChatUserId = userId;

    const chatUsername = chatPanel.querySelector('.chat-username');
    const chatAvatar = chatPanel.querySelector('.chat-avatar img');
    const chatStatus = chatPanel.querySelector('.chat-status');

    if (chatUsername) {
        chatUsername.textContent = username || 'Kullanıcı';
    }

    if (chatAvatar) {
        chatAvatar.src = avatar || defaultAvatar;
    }

    if (chatStatus) {
        chatStatus.textContent = onlineFriends.has(userId) ? 'Çevrimiçi' : 'Çevrimdışı';
    }

    // Mesaj yazma alanına odaklan
    setTimeout(() => {
        const textarea = chatPanel.querySelector('.chat-textbox textarea');
        if (textarea) textarea.focus();
    }, 100);
}

// Sohbet panelini kapat
function closeChatPanel() {
    const chatPanel = document.querySelector('.chat-panel');
    if (!chatPanel) return;

    chatPanel.classList.add('hidden');
    document.querySelector('.dashboard-container').classList.remove('chat-open');

    // Aktif sohbeti temizle
    chatPanel.dataset.activeChatUserId = '';
}

// Mesaj gönder
function sendMessage(inputElement) {
    if (!inputElement) return;

    const message = inputElement.value.trim();
    if (!message) return;

    const chatPanel = document.querySelector('.chat-panel');
    if (!chatPanel || !chatPanel.dataset.activeChatUserId) return;

    const receiverId = chatPanel.dataset.activeChatUserId;

    // Mesajı UI'a ekle (ileride backend'e kaydetme işlemi de eklenmelidir)
    const messageObj = {
        id: Date.now().toString(),
        content: message,
        sender_id: currentUserId,
        receiver_id: receiverId,
        created_at: new Date().toISOString(),
        read: false
    };

    appendNewMessage(messageObj);

    // Input'u temizle
    inputElement.value = '';

    console.log(`Mesaj gönderildi: ${message} - Alıcı: ${receiverId}`);
}

// Yeni mesajı UI'a ekle
function appendNewMessage(message) {
    const messagesContainer = document.querySelector('.chat-messages');
    if (!messagesContainer) return;

    // Son mesaj grubunu bul
    let lastGroup = messagesContainer.lastElementChild;

    // İlk mesaj veya farklı gönderen
    if (!lastGroup || !lastGroup.classList.contains('message-group') ||
        (message.sender_id === currentUserId && !lastGroup.classList.contains('own-message')) ||
        (message.sender_id !== currentUserId && lastGroup.classList.contains('own-message'))) {

        // Yeni mesaj grubu oluştur
        const newGroup = document.createElement('div');
        newGroup.className = `message-group ${message.sender_id === currentUserId ? 'own-message' : ''}`;

        // Avatar bölümü
        const avatar = document.createElement('div');
        avatar.className = 'message-group-avatar';

        // Avatar resmi
        const img = document.createElement('img');
        img.src = message.sender_id === currentUserId
            ? (currentUserAvatar || defaultAvatar)
            : (document.querySelector('.chat-avatar img')?.src || defaultAvatar);

        avatar.appendChild(img);
        newGroup.appendChild(avatar);

        // Mesaj içerik alanı
        const content = document.createElement('div');
        content.className = 'message-group-content';

        // Mesaj başlığı
        const header = document.createElement('div');
        header.className = 'message-group-header';

        const author = document.createElement('div');
        author.className = 'message-author';
        author.textContent = message.sender_id === currentUserId
            ? (currentUserUsername || 'Sen')
            : (document.querySelector('.chat-username')?.textContent || 'Kullanıcı');

        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        header.appendChild(author);
        header.appendChild(time);
        content.appendChild(header);

        // Mesaj içeriği
        const msgContent = document.createElement('div');
        msgContent.className = 'message-content';
        msgContent.innerHTML = `<p>${message.content}</p>`;
        content.appendChild(msgContent);

        newGroup.appendChild(content);
        messagesContainer.appendChild(newGroup);
    }
    // Aynı gönderen
    else {
        const msgContent = lastGroup.querySelector('.message-content');
        if (msgContent) {
            msgContent.innerHTML += `<p>${message.content}</p>`;
        }

        // Zaman bilgisini güncelle
        const timeElement = lastGroup.querySelector('.message-time');
        if (timeElement) {
            timeElement.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    // Sohbet alanını en alta kaydır
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Çıkış işlemi
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error('Çıkış yapılırken hata oluştu:', error.message);
            showNotification('Çıkış yapılırken bir hata oluştu', 'error');
            return;
        }

        console.log('Başarıyla çıkış yapıldı');
        window.location.href = 'login.html';

    } catch (error) {
        console.error('Çıkış hatası:', error);
        showNotification('Çıkış yapılırken bir hata oluştu', 'error');
    }
}

