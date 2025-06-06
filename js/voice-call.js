// WebRTC Sesli Arama İşlevselliği
// Supabase kullanımı için auth_config.js'deki supabase istemcisini içe aktarıyoruz
import { supabase } from './auth_config.js';

// Global değişkenler
let localStream = null;
let peerConnection = null;
let callTimer = null;
let callDuration = 0;
let currentCallUserId = null;
let currentCallUsername = null;
let currentCallUserAvatar = null;
let isCallActive = false;
let isMuted = false;
let isInitiator = false;
let ringtoneAudio = null; // Zil sesi için ses nesnesi

// Görselleştirici için global değişkenler
let audioContext = null;
let analyser = null;
let visualizerAnimationId = null;
let dataArray = null;

// ICE sunucu yapılandırması - STUN sunucuları
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

// Arama paneli elementleri
const callPanelOverlay = document.querySelector('.call-panel-overlay');
const outgoingCallPanel = document.querySelector('.call-panel.outgoing-call');
const incomingCallPanel = document.querySelector('.call-panel.incoming-call');
const activeCallPanel = document.querySelector('.call-panel.active-call');

// Sesli arama sistemini başlatma
export function initVoiceCallSystem() {
    console.log('📞 Sesli arama sistemi başlatılıyor...');

    // CSS stillerini ekle
    addVoiceCallStyles();

    // Sesli arama butonlarını dinlemeye başla
    setupCallButtons();

    // Gelen aramaları dinlemeye başla
    setupIncomingCallListener();

    // Zil sesini önceden yükle
    preloadRingtone();
}

// Zil sesini önceden yükle
function preloadRingtone() {
    ringtoneAudio = new Audio('sounds/callsound.mp3');
    ringtoneAudio.loop = true;
    ringtoneAudio.load(); // Önceden yükle
    console.log('📞 Zil sesi yüklendi');
}

// CSS stillerini ekleyen fonksiyon
function addVoiceCallStyles() {
    const styleElement = document.createElement('style');
    styleElement.id = 'voice-call-styles';
    styleElement.textContent = `
        /* Sesli arama paneli temel stilleri */
        .call-panel-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.75);
            z-index: 9999;
            display: none;
            justify-content: center;
            align-items: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        }
        
        .call-panel-overlay.active {
            opacity: 1;
        }
        
        .call-panel {
            background: linear-gradient(145deg, #3b4da7, #2c3875);
            border-radius: 16px;
            padding: 24px;
            min-width: 300px;
            max-width: 400px;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            transform: scale(0.9);
            transition: transform 0.3s ease; /* Sadece transform için geçiş */
            position: relative;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .call-panel-overlay.active .call-panel {
            transform: scale(1);
        }
        
        /* Avatar ve kullanıcı bilgileri */
        .call-avatar {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid rgba(255, 255, 255, 0.2);
            margin-bottom: 16px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            transition: box-shadow 0.05s ease-out, border-color 0.05s ease-out; /* Daha hızlı geçiş */
        }
        
        .call-username {
            font-size: 20px;
            font-weight: 600;
            color: white;
            margin-bottom: 8px;
            text-align: center;
        }
        
        .call-status {
            font-size: 16px;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 20px;
            text-align: center;
        }
        
        /* Butonlar */
        .call-actions {
            display: flex;
            gap: 16px;
            margin-top: 12px;
        }
        
        .call-action-btn {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            outline: none;
            cursor: pointer;
            transition: all 0.2s ease;
            color: white;
            font-size: 24px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }
        
        .accept-btn {
            background-color: #4CAF50;
        }
        
        .accept-btn:hover {
            background-color: #43A047;
            transform: translateY(-2px);
        }
        
        .decline-btn, .hangup-btn {
            background-color: #F44336;
        }
        
        .decline-btn:hover, .hangup-btn:hover {
            background-color: #E53935;
            transform: translateY(-2px);
        }
        
        .mute-btn {
            background-color: #2196F3;
        }
        
        .mute-btn:hover {
            background-color: #1E88E5;
            transform: translateY(-2px);
        }
        
        .mute-btn.muted {
            background-color: #607D8B;
        }
        
        /* Arama süresi animasyonu */
        @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }
        
        .active-call .call-status {
            animation: pulse 1.5s infinite;
        }
        
        /* Gelen/Giden arama animasyonu */
        @keyframes calling {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .incoming-call .call-avatar, .outgoing-call .call-avatar {
            animation: calling 1.5s infinite;
        }
    `;

    // Stil zaten varsa kaldır
    const existingStyle = document.getElementById('voice-call-styles');
    if (existingStyle) {
        existingStyle.remove();
    }

    // Yeni stili ekle
    document.head.appendChild(styleElement);
    console.log('📞 Sesli arama stilleri eklendi');
}

// Chat panel içindeki arama butonlarını dinleme
function setupCallButtons() {
    // Sohbet başlığındaki sesli arama butonunu bul
    const voiceCallButton = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');

    if (voiceCallButton) {
        console.log('📞 Sesli arama butonu bulundu, olay dinleyicisi ekleniyor...');
        voiceCallButton.addEventListener('click', handleVoiceCallButtonClick);
    } else {
        console.error('⚠️ Sesli arama butonu bulunamadı!');
    }

    // Gelen arama panel butonları
    const acceptCallButton = document.querySelector('.call-panel.incoming-call .accept-btn');
    const declineCallButton = document.querySelector('.call-panel.incoming-call .decline-btn');

    if (acceptCallButton) {
        acceptCallButton.addEventListener('click', acceptIncomingCall);
    }

    if (declineCallButton) {
        declineCallButton.addEventListener('click', declineIncomingCall);
    }

    // Aktif arama panel butonları
    const hangupButton = document.querySelectorAll('.call-action-btn.hangup-btn');
    const muteButton = document.querySelector('.call-panel.active-call .mute-btn');

    hangupButton.forEach(button => {
        button.addEventListener('click', endCall);
    });

    if (muteButton) {
        muteButton.addEventListener('click', toggleMute);
    }
}

// Sesli arama butonuna tıklandığında
function handleVoiceCallButtonClick() {
    console.log('📞 Sesli arama butonu tıklandı');

    // Butona tıklama geri bildirimi
    const button = document.querySelector('.chat-header-actions .chat-action-btn[title="Sesli Arama"]');
    if (button) {
        // Geçici vurgu efekti ekle
        button.classList.add('active-call-btn');
        setTimeout(() => {
            button.classList.remove('active-call-btn');
        }, 300);
    }

    // Aktif sohbetteki kullanıcı bilgilerini al
    const chatPanel = document.querySelector('.chat-panel');
    const userId = chatPanel.dataset.activeChatUserId;
    const usernameElement = chatPanel.querySelector('.chat-username');
    const avatarElement = chatPanel.querySelector('.chat-avatar img');

    if (!userId || !usernameElement) {
        console.error('⚠️ Arama için gerekli kullanıcı bilgileri bulunamadı!');
        return;
    }

    const username = usernameElement.textContent;
    const avatar = avatarElement ? avatarElement.src : 'images/DefaultAvatar.png';

    // Kullanıcının çevrimiçi olup olmadığını çeşitli yöntemlerle kontrol et
    // 1. dashboard.js tarafından ayarlanan data attribute (en güvenilir)
    const datasetIsOnline = chatPanel.dataset.userIsOnline === 'true';
    // 2. chat-avatar içindeki status-dot'u kontrol et
    const statusDot = chatPanel.querySelector('.chat-avatar .status-dot');
    const dotIsOnline = statusDot && statusDot.classList.contains('online');
    // 3. chat-status içinde "Çevrimiçi" ifadesini ara
    const statusText = chatPanel.querySelector('.chat-status');
    const statusIsOnline = statusText && statusText.textContent.includes('Çevrimiçi');
    // 4. DM listesinde bu kullanıcının durumunu kontrol et
    const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"] .dm-status.online`);
    const dmIsOnline = dmItem !== null;

    // En az bir yöntemle çevrimiçi tespit edildiyse aramaya izin ver
    const isOnline = datasetIsOnline || dotIsOnline || statusIsOnline || dmIsOnline;

    console.log('📞 Çevrimiçi durum kontrolü:', {
        datasetIsOnline,
        dotIsOnline,
        statusIsOnline,
        dmIsOnline,
        sonuç: isOnline
    });

    // GELİŞTİRME: Şu an geliştirme aşamasında olduğumuz için çevrimiçi kontrolünü devre dışı bırakıyoruz
    const DEV_MODE = true; // Geliştirme modunu açık bırak

    // Çevrimiçi değilse bile çalışsın
    if (!isOnline && !DEV_MODE) {
        alert('Kullanıcı çevrimiçi değil. Sadece çevrimiçi kullanıcılar aranabilir.');
        return;
    }

    // Arama başlat
    startCall(userId, username, avatar);
}

// Kullanıcıyı aramaya başla
async function startCall(userId, username, avatar) {
    if (!isCallSupported) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Kullanıcı oturumu bulunamadı.');

        currentCallUserId = userId;
        currentCallUserAvatar = avatar;

        // Hedef kullanıcının profilini al (kullanıcı adını doğrulamak için)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username, avatar')
            .eq('id', userId)
            .single();

        if (profileError) {
            throw profileError;
        }

        // Mikrofon erişimi iste
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // WebRTC bağlantısını kur
        createPeerConnection();

        // Yerel akışı bağlantıya ekle
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Offer oluştur
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Supabase üzerinden teklifi ilet
        await sendCallSignal({
            type: 'offer',
            offer: peerConnection.localDescription,
            from: {
                userId: user.id,
                username: profile?.username || 'Anonim Kullanıcı',
                avatar: profile?.avatar || 'images/DefaultAvatar.png'
            },
            callType: 'voice'
        }, userId);

        // Giden arama zil sesini çal
        if (ringtoneAudio) {
            ringtoneAudio.currentTime = 0;
            ringtoneAudio.play().catch(e => console.warn('Zil sesi çalınamadı:', e));
        }

        // Giden arama panelini göster
        showOutgoingCallUI(username, avatar);

    } catch (error) {
        console.error('📞 Arama başlatılırken hata oluştu:', error);
        endCall();
        alert('Arama başlatılamadı. Mikrofonunuza erişim izni olduğundan emin olun.');
    }
}

// Gelen aramaları dinlemeye başla
async function setupIncomingCallListener() {
    try {
        // Mevcut kullanıcı ID'sini Supabase'den al
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) {
            throw error;
        }

        if (!user) {
            console.warn('📞 Kullanıcı oturumu bulunamadı, gelen arama dinleyicisi başlatılamıyor.');
            return;
        }

        const userId = user.id;
        console.log('📞 Gelen arama dinleyicisi başlatılıyor... Kullanıcı ID:', userId);

        // Supabase realtime aboneliği
        const callChannel = supabase
            .channel('call-signals')
            .on('broadcast', { event: 'call' }, (payload) => {
                // Sinyal içindeki targetUserId kontrol edilecek
                const signal = payload.payload;
                if (!signal || !signal.targetUserId || signal.targetUserId !== userId) {
                    // Bu sinyal bize yönelik değil, yoksay
                    return;
                }

                handleCallSignal(payload);
            })
            .subscribe();

        console.log('📞 Arama kanalına abone olundu:', callChannel);
    } catch (error) {
        console.error('📞 Gelen arama dinleyicisi başlatılırken hata oluştu:', error);
    }
}

// Arama sinyali gönderme
async function sendCallSignal(signal, targetUserId) {
    try {
        console.log(`📞 Sinyal gönderiliyor: ${signal.type} => Kullanıcı: ${targetUserId}`);

        // Supabase broadcast ile arama sinyalini gönder
        const { error } = await supabase
            .channel('call-signals')
            .send({
                type: 'broadcast',
                event: 'call',
                payload: {
                    ...signal,
                    targetUserId: targetUserId
                }
            });

        if (error) {
            throw error;
        }

    } catch (error) {
        console.error('📞 Sinyal gönderilirken hata oluştu:', error);
    }
}

// Arama sinyali alındığında
function handleCallSignal(payload) {
    // Sinyal içeriğini al
    const signal = payload.payload;

    console.log('📞 Arama sinyali alındı:', signal);

    switch (signal.type) {
        case 'offer':
            handleCallOffer(signal);
            break;
        case 'answer':
            handleCallAnswer(signal);
            break;
        case 'candidate':
            handleIceCandidate(signal);
            break;
        case 'hangup':
            handleRemoteHangup();
            break;
        default:
            console.warn('📞 Bilinmeyen sinyal türü:', signal.type);
    }
}

// Gelen arama teklifi
async function handleCallOffer(signal) {
    // Zaten görüşme varsa reddedelim
    if (isCallActive) {
        sendCallSignal({
            type: 'hangup',
            reason: 'busy'
        }, signal.from.userId);
        return;
    }

    currentCallUserId = signal.from.userId;
    currentCallUsername = signal.from.username;
    currentCallUserAvatar = signal.from.avatar;
    isInitiator = false;

    // Gelen arama zil sesini çal
    if (ringtoneAudio) {
        ringtoneAudio.currentTime = 0;
        ringtoneAudio.play().catch(e => console.warn('Zil sesi çalınamadı:', e));
    }

    // Gelen arama panelini göster
    showIncomingCallUI(signal.from.username, signal.from.avatar);

    // Offer ve from bilgilerini geçici olarak saklayalım
    incomingCallPanel.dataset.offer = JSON.stringify(signal.offer);
    incomingCallPanel.dataset.fromUserId = signal.from.userId;
}

// Arama cevabı alındığında
async function handleCallAnswer(signal) {
    if (peerConnection && peerConnection.signalingState !== 'closed') {
        try {
            console.log('📞 Arama cevabı alındı, uzak açıklama ayarlanıyor...');
            await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
        } catch (error) {
            console.error('📞 Uzak açıklama ayarlanırken hata oluştu:', error);
        }
    }
}

// ICE adayı alındığında
async function handleIceCandidate(signal) {
    if (peerConnection && peerConnection.signalingState !== 'closed' && signal.candidate) {
        try {
            console.log('📞 ICE adayı alındı:', signal.candidate);
            await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (error) {
            console.error('📞 ICE adayı eklenirken hata oluştu:', error);
        }
    }
}

// Uzak taraf aramayı sonlandırdığında
function handleRemoteHangup() {
    console.log('📞 Karşı taraf görüşmeyi sonlandırdı.');
    endCall();
}

// WebRTC bağlantısını oluştur
function createPeerConnection() {
    if (peerConnection) {
        console.warn('📞 Zaten bir bağlantı mevcut, önce temizleniyor...');
        peerConnection.close();
        peerConnection = null;
    }

    console.log('📞 Yeni WebRTC bağlantısı oluşturuluyor...');
    peerConnection = new RTCPeerConnection(iceServers);

    // ICE adayı alındığında
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('📞 Yerel ICE adayı bulundu:', event.candidate);
            sendCallSignal({
                type: 'candidate',
                candidate: event.candidate
            }, currentCallUserId);
        }
    };

    // Bağlantı durumu değiştiğinde
    peerConnection.oniceconnectionstatechange = () => {
        console.log('📞 ICE bağlantı durumu değişti:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected' ||
            peerConnection.iceConnectionState === 'completed') {
            // Bağlantı kuruldu, arama aktif
            if (!isCallActive) {
                console.log('📞 Sesli arama bağlantısı kuruldu!');
                showActiveCallUI();
            }
        } else if (peerConnection.iceConnectionState === 'failed' ||
            peerConnection.iceConnectionState === 'disconnected' ||
            peerConnection.iceConnectionState === 'closed') {
            // Bağlantı kesildi veya başarısız oldu
            console.log('📞 Bağlantı kesildi veya başarısız oldu:', peerConnection.iceConnectionState);
            if (isCallActive) {
                endCall();
            }
        }
    };

    // Uzak akış alındığında
    peerConnection.ontrack = (event) => {
        console.log('📞 Uzak ses akışı alındı:', event.streams[0]);

        // Uzak sesi oynatmak için audio elementi oluştur
        const remoteAudioElement = document.getElementById('remoteAudio') || document.createElement('audio');
        remoteAudioElement.id = 'remoteAudio';
        remoteAudioElement.autoplay = true;
        remoteAudioElement.srcObject = event.streams[0];
        if (!remoteAudioElement.parentNode) {
            document.body.appendChild(remoteAudioElement);
        }

        // Ses görselleştiricisini başlat
        if (event.streams && event.streams[0]) {
            startVisualizer(event.streams[0]);
        }
    };

    return peerConnection;
}

// Gelen aramayı kabul et
async function acceptIncomingCall() {
    try {
        console.log('📞 Gelen arama kabul ediliyor...');

        // Zil sesini durdur
        if (ringtoneAudio) {
            ringtoneAudio.pause();
            ringtoneAudio.currentTime = 0;
        }

        // Mikrofon erişimi iste
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false
        });

        // Gelen offer bilgisini al
        const offerStr = incomingCallPanel.dataset.offer;
        if (!offerStr) {
            throw new Error('Offer bilgisi bulunamadı');
        }

        const offer = JSON.parse(offerStr);

        // WebRTC bağlantısını kur
        createPeerConnection();

        // Yerel akışı bağlantıya ekle
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Uzak tanımlamayı ayarla
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Cevap oluştur
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Cevabı gönder
        await sendCallSignal({
            type: 'answer',
            answer: peerConnection.localDescription
        }, currentCallUserId);

        // Arama UI'ını aktif hale getir
        showActiveCallUI();

    } catch (error) {
        console.error('📞 Arama kabul edilirken hata oluştu:', error);
        endCall();
        alert('Arama kabul edilemedi. Mikrofonunuza erişim izni olduğundan emin olun.');
    }
}

// Gelen aramayı reddet
function declineIncomingCall() {
    console.log('📞 Gelen arama reddedildi.');

    // Zil sesini durdur
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    // Arayan tarafa reddetme sinyali gönder
    sendCallSignal({
        type: 'hangup',
        reason: 'rejected'
    }, currentCallUserId);

    // UI'ı temizle
    hideAllCallPanels();
    resetCallState();
}

// Aramayı sonlandır
function endCall() {
    console.log('📞 Arama sonlandırılıyor...');

    // Ses görselleştiricisini durdur
    stopVisualizer();

    // Zil sesini durdur (giden veya gelen arama zil sesleri çalıyorsa)
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    // Eğer aktif bir arama varsa, karşı tarafa bilgi ver
    if (isCallActive && currentCallUserId) {
        sendCallSignal({
            type: 'hangup',
            reason: 'ended'
        }, currentCallUserId);
    }

    // Ses akışını durdur
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Uzak ses elementi varsa kaldır
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
    }

    // WebRTC bağlantısını kapat
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // UI'ı temizle
    hideAllCallPanels();
    resetCallState();

    // Timer'ı durdur
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
}

// Mikrofonun sesini aç/kapat
function toggleMute() {
    if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            isMuted = !isMuted;
            audioTracks.forEach(track => {
                track.enabled = !isMuted;
            });

            // Mute butonunun görünümünü güncelle
            const muteButton = document.querySelector('.call-panel.active-call .mute-btn');
            if (muteButton) {
                const muteIcon = muteButton.querySelector('i');
                if (muteIcon) {
                    if (isMuted) {
                        muteIcon.className = 'fas fa-microphone-slash';
                        muteButton.classList.add('muted');
                    } else {
                        muteIcon.className = 'fas fa-microphone';
                        muteButton.classList.remove('muted');
                    }
                }
            }

            console.log(`📞 Mikrofon ${isMuted ? 'kapatıldı' : 'açıldı'}`);
        }
    }
}

// Giden arama UI'ını göster
function showOutgoingCallUI(username, avatar) {
    console.log('📞 Giden arama paneli gösteriliyor...');

    // Avatar ve kullanıcı adını ayarla
    const callAvatar = outgoingCallPanel.querySelector('.call-avatar');
    const callUsername = outgoingCallPanel.querySelector('.call-username');

    if (callAvatar) callAvatar.src = avatar || 'images/DefaultAvatar.png';
    if (callUsername) callUsername.textContent = `${username} aranıyor...`;

    // Paneli göster
    callPanelOverlay.style.display = 'flex';
    outgoingCallPanel.style.display = 'flex';
    incomingCallPanel.style.display = 'none';
    activeCallPanel.style.display = 'none';

    // Animasyon için gecikme
    setTimeout(() => {
        callPanelOverlay.classList.add('active');
    }, 10);
}

// Gelen arama UI'ını göster
function showIncomingCallUI(username, avatar) {
    console.log('📞 Gelen arama paneli gösteriliyor...');

    // Avatar ve kullanıcı adını ayarla
    const callAvatar = incomingCallPanel.querySelector('.call-avatar');
    const callUsername = incomingCallPanel.querySelector('.call-username');

    if (callAvatar) callAvatar.src = avatar || 'images/DefaultAvatar.png';
    if (callUsername) callUsername.textContent = `${username} arıyor...`;

    // Paneli göster
    callPanelOverlay.style.display = 'flex';
    incomingCallPanel.style.display = 'flex';
    outgoingCallPanel.style.display = 'none';
    activeCallPanel.style.display = 'none';

    // Animasyon için gecikme
    setTimeout(() => {
        callPanelOverlay.classList.add('active');
    }, 10);
}

// Aktif arama UI'ını göster
function showActiveCallUI() {
    console.log('📞 Aktif arama paneli gösteriliyor...');

    // Zil sesini durdur
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }

    // Avatar ve kullanıcı adını ayarla
    const callAvatar = activeCallPanel.querySelector('.call-avatar');
    const callUsername = activeCallPanel.querySelector('.call-username');

    if (callAvatar) callAvatar.src = currentCallUserAvatar || 'images/DefaultAvatar.png';
    if (callUsername) callUsername.textContent = `${currentCallUsername} ile görüşülüyor`;

    // Arama süresini başlat
    callDuration = 0;
    const callStatus = activeCallPanel.querySelector('.call-status');
    if (callStatus) {
        callStatus.textContent = '00:00';

        callTimer = setInterval(() => {
            callDuration++;
            const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
            const seconds = (callDuration % 60).toString().padStart(2, '0');
            callStatus.textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    // Paneli göster
    callPanelOverlay.style.display = 'flex';
    activeCallPanel.style.display = 'flex';
    outgoingCallPanel.style.display = 'none';
    incomingCallPanel.style.display = 'none';

    // Arama aktif olarak işaretle
    isCallActive = true;
}

// Tüm arama panellerini gizle
function hideAllCallPanels() {
    console.log('📞 Arama panelleri gizleniyor...');

    // Animasyonları kaldır
    callPanelOverlay.classList.remove('active');

    // Panelleri gizle (animasyon sonrası)
    setTimeout(() => {
        callPanelOverlay.style.display = 'none';
        outgoingCallPanel.style.display = 'none';
        incomingCallPanel.style.display = 'none';
        activeCallPanel.style.display = 'none';
    }, 300);
}

// Arama durumunu sıfırla
function resetCallState() {
    currentCallUserId = null;
    currentCallUsername = null;
    currentCallUserAvatar = null;
    isCallActive = false;
    isMuted = false;
    isInitiator = false;
    callDuration = 0;

    // Görselleştirici ile ilgili değişkenleri de sıfırla
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(e => console.warn('AudioContext kapatılırken hata:', e));
    }
    audioContext = null;
    analyser = null;
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    dataArray = null;
}

// Sesli arama için hata kontrolü
export function checkVoiceCallSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('📞 WebRTC desteklenmiyor! Sesli arama kullanılamaz.');
        return false;
    }

    return true;
}

// Ses görselleştiricisini başlat
function startVisualizer(stream) {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // AudioContext'in durumunu kontrol et, askıya alınmışsa devam ettir
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    const visualizerAvatar = activeCallPanel.querySelector('.call-avatar');

    function drawVisualizer() {
        if (!isCallActive || !analyser) {
            if (visualizerAvatar) {
                visualizerAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                visualizerAvatar.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
            if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
            visualizerAnimationId = null;
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        let average = sum / bufferLength;

        const visualizerThreshold = 15; // Ses algılama eşiği (0-255 arası)
        const maxGlowSize = 25;        // Maksimum parlama boyutu (px)
        const minGlowSize = 5;         // Minimum parlama boyutu (px)
        const baseBorderOpacity = 0.2; // Temel çerçeve opaklığı
        const maxBorderOpacityBoost = 0.8; // Maksimum çerçeve opaklık artışı
        const baseShadowOpacity = 0.5; // Temel gölge opaklığı
        const maxShadowOpacityBoost = 0.5; // Maksimum gölge opaklık artışı

        if (visualizerAvatar) {
            if (average > visualizerThreshold) {
                const intensity = Math.min(1, (average - visualizerThreshold) / (128 - visualizerThreshold)); // Eşiği hesaba katarak yoğunluk (128 keyfi bir üst sınır)
                const glowSize = minGlowSize + intensity * (maxGlowSize - minGlowSize);
                const borderColorOpacity = baseBorderOpacity + intensity * maxBorderOpacityBoost;
                const shadowOpacity = baseShadowOpacity + intensity * maxShadowOpacityBoost;

                visualizerAvatar.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 2.5}px rgba(76, 200, 80, ${shadowOpacity})`; // Daha canlı yeşil ve ayarlanmış yayılma
                visualizerAvatar.style.borderColor = `rgba(76, 200, 80, ${borderColorOpacity})`;
                visualizerAvatar.classList.add('speaking');
            } else {
                visualizerAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                visualizerAvatar.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                visualizerAvatar.classList.remove('speaking');
            }
        }

        visualizerAnimationId = requestAnimationFrame(drawVisualizer);
    }

    // Zaten bir animasyon çalışıyorsa iptal et
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
    }
    drawVisualizer();
}

// Ses görselleştiricisini durdur
function stopVisualizer() {
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    // Analyser ve source bağlantısını kes
    if (analyser) {
        analyser.disconnect();
        // source.disconnect() -> source zaten analyser'a bağlı, analyser'ı kesmek yeterli
        analyser = null;
    }
    // dataArray'i sıfırla
    dataArray = null;

    const visualizerAvatar = activeCallPanel.querySelector('.call-avatar');
    if (visualizerAvatar) {
        visualizerAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        visualizerAvatar.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        visualizerAvatar.classList.remove('speaking');
    }
    console.log('📞 Ses görselleştiricisi durduruldu.');
} 