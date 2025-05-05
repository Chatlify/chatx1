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

// Tenor API anahtarını doğrudan tanımla
// DİKKAT: API anahtarını doğrudan istemci koduna yazmak güvenlik riski taşır.
// İdealde bu anahtar backend üzerinden veya güvenli bir yapılandırma ile yönetilmelidir.
const TENOR_API_KEY = "YOUR_TENOR_API_KEY"; // BURAYI KENDİ TENOR API KEY'İNİZ İLE DEĞİŞTİRİN

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
    // ... existing code ...

    // Sohbet başlığındaki sesli arama butonunu bul ve işlev ekle
    const voiceCallBtn = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', handleVoiceCallButtonClick);
    }

    // Arama paneli butonlarını ayarla
    setupCallPanelButtons();

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

        // Bildirim sesini çal
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
    // ... existing code ...

    // Sesli aramalar için dinleyici başlat
    listenForCalls();

    // ... existing code ...
}

// ... existing code ...

