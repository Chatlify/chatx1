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
    // Kullanıcı paneli elementlerini seç
    const userPanelUsernameElement = document.querySelector('#user-panel-username'); // ID'yi kontrol et
    const userPanelAvatarElement = document.querySelector('#user-panel-avatar img'); // Seçiciyi kontrol et

    // Oturumu başlat ve ilk verileri yükle (ÇAĞRI EKLENDİ)
    await initializeUserSession({ userPanelUsernameElement, userPanelAvatarElement });

    // ... Diğer DOMContentLoaded kodları ...

    // Sohbet başlığındaki sesli arama butonunu bul ve işlev ekle
    const voiceCallBtn = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener('click', handleVoiceCallButtonClick);
    }

    // Arama paneli butonlarını ayarla
    setupCallPanelButtons();

    // ... existing code ...

    // *** ÖNEMLİ: Veri yükleme fonksiyonları initializeUserSession içinde çağrılmalı ***
    // Bu çağrılar initializeUserSession içine taşınmalı veya ondan sonra yapılmalı
    // console.log('Arkadas listesi yukleniyor...');
    // await loadFriendsList(); // initializeUserSession içinde zaten çağrılıyor (olmalı)
    // console.log('Sponsorlu sunucular yukleniyor...');
    // await loadSponsoredServers(); // initializeUserSession içinde zaten çağrılıyor (olmalı)
    // console.log('Okunmamis mesajlar yukleniyor...');
    // await loadUnreadMessages(); // initializeUserSession içinde zaten çağrılıyor (olmalı)

    // Realtime presence takibini başlat
    // initializePresence(); // Bu initializeUserSession içine taşınabilir veya burada kalabilir
    // listenForMessages(); // Bu initializeUserSession içine taşınabilir veya burada kalabilir
    // listenForCalls(); // Bu initializeUserSession içine taşınabilir veya burada kalabilir
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
    console.log('Oturum baslatiliyor ve veriler yukleniyor...');
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Oturum bilgileri alinamadi:', authError?.message);
            return;
        }

        currentUserId = user.id;
        console.log('Kullanici ID:', currentUserId);

        // Kullanıcı profil bilgilerini getir
        // DİKKAT: SQL çıktısına göre 'profiles' tablosunda avatar sütunu yok.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username') // Avatar sütunu kaldırıldı
            .eq('id', currentUserId)
            .single();

        let currentUserUsername = 'Kullanici';
        // Avatar sütunu olmadığı için varsayılanı kullan
        let currentUserAvatar = defaultAvatar;
        if (userPanelAvatarElement) userPanelAvatarElement.src = currentUserAvatar;

        if (profileError) {
            console.error('Profil bilgileri alinamadi (avatar sütunu eksik olabilir):', profileError.message);
        } else if (profile) {
            console.log('Profil bilgileri:', profile);
            currentUserUsername = profile.username || 'Kullanici';
            if (userPanelUsernameElement) userPanelUsernameElement.textContent = currentUserUsername;
        }

        // *** Veri yükleme fonksiyonları ARTIK BURADA çağrılmalı ***
        console.log("Arkadas listesi yukleniyor...");
        await loadFriendsList();
        // console.log("Sponsorlu sunucular yukleniyor..."); // Sponsor bölümü statik
        // await loadSponsoredServers(); // Sponsor bölümü statik
        console.log("Okunmamis mesajlar yukleniyor...");
        await loadUnreadMessages();

        // Realtime servisleri başlat
        initializePresence();
        listenForMessages();
        listenForCalls();

        console.log('Oturum basariyla baslatildi.');

    } catch (error) {
        // Hata logları güncellendi
        if (error instanceof ReferenceError && error.message.includes('initializePresence is not defined')) {
            console.error('HATA: initializePresence fonksiyonu bulunamadı!');
        } else if (error instanceof ReferenceError && error.message.includes('listenForMessages is not defined')) {
            console.error('HATA: listenForMessages fonksiyonu bulunamadı!');
        } else {
            console.error('Oturum baslatilirken genel hata:', error.message);
        }
    }
}

// --- Veri Yükleme Fonksiyonları (Güncellendi) ---

// Arkadaş listesini yükler ve arayüzü günceller
async function loadFriendsList() {
    if (!currentUserId) {
        console.error('loadFriendsList: Kullanici ID bulunamadi.');
        return;
    }
    console.log("Arkadas listesi (friendships) Supabase'den cekiliyor...");
    try {
        // 1. Kabul edilmiş arkadaşlıkları çek (friendships tablosu)
        const { data: friendships, error: friendshipsError } = await supabase
            .from('friendships') // Tablo adı düzeltildi
            .select('user_id_1, user_id_2') // İki kullanıcı ID'sini de al
            .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`) // Kullanıcının dahil olduğu satırları bul
            .eq('status', 'accepted'); // Sadece kabul edilmiş arkadaşlıklar

        if (friendshipsError) throw friendshipsError;

        if (!friendships || friendships.length === 0) {
            console.log('Kabul edilmiş arkadaş bulunamadı.');
            // TODO: Arayüzde "arkadaş yok" mesajını göster (online/offline listelerini temizle)
            return;
        }

        // 2. Arkadaşların ID'lerini çıkar
        const friendIds = friendships.map(friendship => {
            return friendship.user_id_1 === currentUserId ? friendship.user_id_2 : friendship.user_id_1;
        });

        // 3. Arkadaş ID'leri ile profil bilgilerini çek (profiles tablosu)
        // DİKKAT: SQL çıktısına göre 'profiles' tablosunda avatar ve status sütunu yok.
        const { data: friendsProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username') // Avatar ve status sütunları kaldırıldı
            .in('id', friendIds);

        if (profilesError) throw profilesError;

        console.log('Arkadas profilleri (avatar/status eksik):', friendsProfiles);

        // TODO: Çekilen friendsProfiles verisi ile HTML'deki arkadaş listesini (online/offline) güncelle.
        //       - onlineFriends Set'ini kullanarak online/offline ayırımı yap.
        //       - Her bir profil için bir arkadaş kartı oluştur/güncelle (varsayılan avatar kullanılacak).
        //       - Status bilgisi olmadığı için UI'da durum gösterilemeyebilir.

    } catch (error) {
        if (error.message.includes('relation "public.friends" does not exist')) {
            console.error("loadFriendsList Hatasi: Veritabaninda 'friends' tablosu bulunamadi. 'friendships' kullaniliyor olmali, kontrol ediniz.");
        } else if (error.message.includes('relation "public.friendships" does not exist')) {
            console.error("loadFriendsList Hatasi: Veritabaninda 'friendships' tablosu bulunamadi. Arkadaslik tablosunun adini kontrol ediniz.");
        } else {
            console.error('Arkadas listesi yuklenirken hata:', error.message);
        }
        // TODO: Arayüzde hata mesajı göster
    }
}

// Sponsorlu sunucuları yükler ve arayüzü günceller (Şimdilik devre dışı)
/*
async function loadSponsoredServers() { ... } 
*/

// Okunmamış mesaj sayısını yükler ve arayüzü günceller (varsa)
async function loadUnreadMessages() {
    if (!currentUserId) {
        console.error('loadUnreadMessages: Kullanici ID bulunamadi.');
        return;
    }
    console.log('Okunmamis mesajlar kontrol ediliyor...');
    try {
        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiverId', currentUserId) // Sütun adı düzeltildi
            .eq('isRead', false); // Sütun adı düzeltildi

        if (error) throw error;

        console.log('Okunmamis mesaj sayisi:', count);
        unreadCounts.total = count; // Global sayacı güncelle

        // TODO: Arayüzde toplam okunmamış mesaj sayısını gösteren elementi güncelle (varsa).
        // TODO: Bireysel sohbetler için okunmamış sayıları da çekmek ve unreadCounts objesini doldurmak.

    } catch (error) {
        console.error('Okunmamis mesajlar yuklenirken hata:', error.message);
    }
}

// --- Realtime Fonksiyonları ---

// Kullanıcıların çevrimiçi durumunu takip eder
function initializePresence() {
    if (!currentUserId) {
        console.error('initializePresence: Kullanici ID bulunamadi.');
        return;
    }
    console.log('Realtime Presence başlatılıyor...');

    // Benzersiz bir kanal adı kullanın
    presenceChannel = supabase.channel('online-users', {
        config: {
            presence: {
                key: currentUserId // Her istemciyi benzersiz şekilde tanımlar
            }
        }
    });

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            console.log('Presence sync başladı.');
            const newState = presenceChannel.presenceState();
            console.log('Mevcut kullanıcılar:', newState);
            // onlineFriends set'ini güncelle
            onlineFriends.clear();
            for (const id in newState) {
                onlineFriends.add(id);
            }
            updateFriendStatusesUI(); // UI'ı güncelle
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log('Kullanıcı katıldı:', key, newPresences);
            onlineFriends.add(key);
            updateFriendStatusesUI(); // UI'ı güncelle
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log('Kullanıcı ayrıldı:', key, leftPresences);
            onlineFriends.delete(key);
            updateFriendStatusesUI(); // UI'ı güncelle
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Presence kanalına abone olundu.');
                // Kendi durumunu takip etmeye başla
                const trackStatus = await presenceChannel.track({ online_at: new Date().toISOString() });
                console.log('Track status:', trackStatus);
            } else {
                console.error('Presence kanalına abone olurken hata:', status);
            }
        });
}

// Yeni mesajları dinler
function listenForMessages() {
    if (!currentUserId) {
        console.error('listenForMessages: Kullanici ID bulunamadi.');
        return;
    }
    console.log('Yeni mesajlar dinleniyor...');

    if (messageSubscription) {
        messageSubscription.unsubscribe(); // Önceki aboneliği kaldır
    }

    messageSubscription = supabase
        .channel('public:messages') // messages tablosunu dinle
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiverId=eq.${currentUserId}` },
            (payload) => {
                console.log('Yeni mesaj alındı:', payload.new);
                const newMessage = payload.new;

                // TODO: Yeni mesajı işle
                if (newMessage.conversationId === currentConversationId) {
                    // Aktif sohbete mesajı ekle
                    appendMessageToChat(newMessage);
                    // TODO: Mesajı okundu olarak işaretle?
                } else {
                    // Okunmamış sayısını artır ve UI'ı güncelle
                    const senderId = newMessage.senderId;
                    unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
                    updateUnreadCountUI(senderId, unreadCounts[senderId]);
                    playMessageSound(); // Bildirim sesi çal
                }
            }
        )
        .subscribe((status, err) => {
            if (err) {
                console.error('Mesaj aboneliği hatası:', err);
            } else {
                console.log('Mesaj kanalına abone olundu, durum:', status);
            }
        });
}

// --- Yardımcı UI Fonksiyonları (Taslak) ---

// Arkadaş listesindeki durum ikonlarını günceller
function updateFriendStatusesUI() {
    console.log('Arkadaş durumları UI güncelleniyor. Online:', onlineFriends);
    const friendRows = document.querySelectorAll('.friend-row[data-user-id]'); // Arkadaş satırlarını seç (data-user-id gerekli)
    friendRows.forEach(row => {
        const userId = row.dataset.userId;
        const statusIndicator = row.querySelector('.friend-status'); // Durum göstergesi elementini bul

        if (statusIndicator) {
            if (onlineFriends.has(userId)) {
                statusIndicator.classList.add('online');
                statusIndicator.classList.remove('offline'); // veya diğer durumlar
                // TODO: Durum metnini güncelle (varsa)
            } else {
                statusIndicator.classList.remove('online');
                statusIndicator.classList.add('offline');
                // TODO: Durum metnini güncelle (varsa)
            }
        }
        // TODO: Online/Offline listeleri arasında arkadaşları taşıma mantığı eklenebilir.
    });
    // Not: 'profiles' tablosunda status sütunu olmadığı için detaylı durum (idle, dnd) gösterilemez.
}

// Yeni mesajı sohbet penceresine ekler (Taslak)
function appendMessageToChat(message) {
    console.log('Mesaj sohbete ekleniyor (Taslak):', message);
    // TODO: Gerçek mesaj ekleme HTML/DOM manipülasyonunu buraya ekle.
    //       - Mesajın kimden geldiğine göre (currentUserId vs message.senderId) stil uygula.
    //       - '.chat-messages-list' veya benzeri bir konteynere ekle.
    //       - Zaman damgasını formatla.
}

// Belirli bir kullanıcının okunmamış mesaj sayısını arayüzde günceller (Taslak)
function updateUnreadCountUI(userId, count) {
    console.log(`Kullanıcı ${userId} için okunmamış sayı güncelleniyor: ${count} (Taslak)`);
    // TODO: İlgili arkadaş satırını veya DM listesi öğesini bul (data-user-id kullanarak).
    //       - Okunmamış mesaj sayısını gösteren bir badge/elementi güncelle.
    //       - Sayı 0 ise badge'i gizle.
}