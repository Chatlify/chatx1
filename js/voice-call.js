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
let visualizerFrameId = null;
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
            transition: transform 0.3s ease;
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
            transition: transform 0.1s ease-out, box-shadow 0.1s ease-out; /* Görselleştirici için geçiş */
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
    try {
        console.log(`📞 ${username} (${userId}) kullanıcısına arama başlatılıyor...`);

        // Aranan kullanıcı bilgilerini kaydet
        currentCallUserId = userId;
        currentCallUsername = username;
        currentCallUserAvatar = avatar;
        isInitiator = true;

        // Kendi kullanıcı bilgilerini al
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error('Kullanıcı bilgileri alınamadı: ' + (userError?.message || 'Oturum bulunamadı'));
        }

        // Profil bilgilerini al
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', user.id)
            .maybeSingle();

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
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = 'remoteAudio';
        remoteAudio.autoplay = true;
        remoteAudio.srcObject = event.streams[0];
        document.body.appendChild(remoteAudio);

        // Görselleştiriciyi başlat
        if (event.streams && event.streams[0]) {
            setupVisualizer(event.streams[0]);
        }
    };

    return peerConnection;
}

// Görselleştiriciyi ayarlayan fonksiyon
function setupVisualizer(stream) {
    if (audioContext) { // Zaten varsa önce temizle
        if (audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.warn('Eski AudioContext kapatılırken hata:', e));
        }
        audioContext = null;
        analyser = null;
        if (visualizerFrameId) {
            cancelAnimationFrame(visualizerFrameId);
            visualizerFrameId = null;
        }
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Daha hızlı tepki için daha küçük FFT boyutu
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        source.connect(analyser);

        console.log('📞 Ses görselleştirici ayarlandı.');
        drawVisualizerLoop(); // Görselleştirici döngüsünü başlat
    } catch (e) {
        console.error('📞 Ses görselleştirici ayarlanamadı:', e);
    }
}

// Görselleştiriciyi çizen döngü
function drawVisualizerLoop() {
    if (!analyser || !isCallActive || !activeCallPanel || activeCallPanel.style.display === 'none') {
        if (visualizerFrameId) {
            cancelAnimationFrame(visualizerFrameId);
            visualizerFrameId = null;
        }
        // Çağrı aktif değilse veya panel görünür değilse avatar stilini sıfırla
        const avatar = activeCallPanel ? activeCallPanel.querySelector('.call-avatar') : null;
        if (avatar) {
            avatar.style.transform = 'scale(1)';
            avatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)'; // Orijinal gölge
        }
        return;
    }

    visualizerFrameId = requestAnimationFrame(drawVisualizerLoop);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    const avg = dataArray.length > 0 ? sum / dataArray.length : 0;

    const activeCallAvatar = activeCallPanel.querySelector('.call-avatar');
    if (activeCallAvatar) {
        const normalizedAvg = avg / 255; // 0-1 aralığına normalize et

        // Ölçek efekti (hafif)
        const scaleFactor = 1 + normalizedAvg * 0.05; // Maksimum %5 büyüme
        activeCallAvatar.style.transform = `scale(${scaleFactor})`;

        // "Çerçeve" için parlama efekti
        const baseGlowIntensity = 0.05; // Ses algılandığında minimum parlama
        const dynamicGlowIntensity = normalizedAvg * 0.65; // Sese göre ek parlama (maksimum 0.65)
        const glowOpacity = Math.min(baseGlowIntensity + dynamicGlowIntensity, 0.7); // 0.7 ile sınırla

        const glowSize = 5 + normalizedAvg * 20; // Parlama yayılımı 5px ile 25px arası

        // Sadece ses yeterince güçlüyse aktif parlamayı uygula
        if (avg > 10) { // Parlamayı aktifleştime eşiği (0-255 arası bir değer)
            activeCallAvatar.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 2}px rgba(76, 175, 80, ${glowOpacity})`;
        } else {
            // Dinlenme durumu gölgesi (orijinal)
            activeCallAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
        }
    }
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

    // Görselleştiriciyi durdur ve sıfırla (eğer bir şekilde çalışıyorsa)
    if (visualizerFrameId) {
        cancelAnimationFrame(visualizerFrameId);
        visualizerFrameId = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(e => console.warn('AudioContext kapatılırken hata (decline):', e));
    }
    audioContext = null;
    analyser = null;
    dataArray = null;
    const avatar = activeCallPanel ? activeCallPanel.querySelector('.call-avatar') : null;
    if (avatar) {
        avatar.style.transform = 'scale(1)';
        avatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    }

    // Arayan tarafa reddetme sinyali gönder
    sendCallSignal({
        type: 'hangup',
        reason: 'rejected'
    }, currentCallUserId);

    // UI'ı temizle
    hideAllCallPanels();
    resetCallState();

    // Timer'ı durdur
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }

    // Görselleştiriciyi durdur ve kaynakları serbest bırak
    if (visualizerFrameId) {
        cancelAnimationFrame(visualizerFrameId);
        visualizerFrameId = null;
    }
    if (audioContext) {
        if (audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.error("AudioContext kapatılırken hata (endCall):", e));
        }
        audioContext = null;
        analyser = null;
        dataArray = null;
    }
    // Avatar stilini son bir kez sıfırla
    const activeCallAvatar = activeCallPanel.querySelector('.call-avatar');
    if (activeCallAvatar) {
        activeCallAvatar.style.transform = 'scale(1)';
        activeCallAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    }
}

// Aramayı sonlandır
function endCall() {
    console.log('📞 Arama sonlandırılıyor...');

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

    // Görselleştiriciyi durdur ve kaynakları serbest bırak
    if (visualizerFrameId) {
        cancelAnimationFrame(visualizerFrameId);
        visualizerFrameId = null;
    }
    if (audioContext) {
        if (audioContext.state !== 'closed') {
            audioContext.close().catch(e => console.error("AudioContext kapatılırken hata (endCall):", e));
        }
        audioContext = null;
        analyser = null;
        dataArray = null;
    }
    // Avatar stilini son bir kez sıfırla
    const activeCallAvatar = activeCallPanel.querySelector('.call-avatar');
    if (activeCallAvatar) {
        activeCallAvatar.style.transform = 'scale(1)';
        activeCallAvatar.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
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
}

// Sesli arama için hata kontrolü
export function checkVoiceCallSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('📞 WebRTC desteklenmiyor! Sesli arama kullanılamaz.');
        return false;
    }

    return true;
} 