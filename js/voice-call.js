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
let audioContext = null; // AudioContext'i global yap
let localAnalyserNode = null;
let remoteAnalyserNode = null;
let visualizerAnimationId = null;

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

// Ring sound variables
let callRingSound = null;
const RING_SOUND_PATH = 'sounds/callsound.mp3'; // User will create this file in sounds/

// DOM Elements
const outgoingCallUsername = outgoingCallPanel.querySelector('.call-username');
const outgoingCallAvatar = outgoingCallPanel.querySelector('.call-avatar');
const incomingCallUsername = incomingCallPanel.querySelector('.call-username');
const incomingCallAvatar = incomingCallPanel.querySelector('.call-avatar');
const incomingCallDeclineButton = document.getElementById('incoming-call-decline');
const activeCallHangupButton = document.getElementById('active-call-hangup');
const muteButton = document.getElementById('mute-call-btn');
const callTimerDisplay = document.getElementById('call-timer');
const localAudioVisualizer = document.getElementById('localAudioVisualizer');
const remoteAudioVisualizer = document.getElementById('remoteAudioVisualizer');

// Sesli arama sistemini başlatma
export function initVoiceCallSystem() {
    console.log('📞 Sesli arama sistemi başlatılıyor...');
    // Sesli arama butonlarını dinlemeye başla
    setupCallButtons();
    // Gelen aramaları dinlemeye başla
    setupIncomingCallListener();
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
    if (!audioContext) { // Sadece bir kere oluştur
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

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

        // Uzak akış için görselleştiriciyi ayarla (aktif arama panelindeki)
        if (activeCallPanel && activeCallPanel.style.display === 'flex') {
            const remoteVisualizerCanvas = activeCallPanel.querySelector('.voice-visualizer');
            if (remoteVisualizerCanvas) {
                remoteAnalyserNode = setupVisualizer(event.streams[0], remoteVisualizerCanvas, audioContext, 'remote');
                drawVisualization(remoteVisualizerCanvas, remoteAnalyserNode, 'remote');
            }
        }
    };

    return peerConnection;
}

// Gelen aramayı kabul et
async function acceptIncomingCall() {
    try {
        console.log('📞 Gelen arama kabul ediliyor...');

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
    console.log("Showing outgoing call UI for:", username);
    outgoingCallUsername.textContent = username;
    outgoingCallAvatar.src = avatar || 'assets/default-avatar.png';
    callPanelOverlay.classList.add('active');
    outgoingCallPanel.style.display = 'flex';
    incomingCallPanel.style.display = 'none';
    activeCallPanel.style.display = 'none';
    currentCallType = 'outgoing';
    playRingingSound();
}

// Gelen arama UI'ını göster
function showIncomingCallUI(username, avatar) {
    console.log("Showing incoming call UI from:", username);
    incomingCallUsername.textContent = username;
    incomingCallAvatar.src = avatar || 'assets/default-avatar.png';
    callPanelOverlay.classList.add('active');
    outgoingCallPanel.style.display = 'none';
    incomingCallPanel.style.display = 'flex';
    activeCallPanel.style.display = 'none';
    currentCallType = 'incoming';
    playRingingSound();
}

// Aktif arama UI'ını göster
function showActiveCallUI() {
    console.log('📞 Aktif arama paneli gösteriliyor...');

    // Eğer çalan bir zil sesi varsa durdur
    if (incomingCallPanel.dataset.ringtone === 'playing') {
        const ringtoneAudio = document.querySelector('#ringtoneAudio');
        if (ringtoneAudio) {
            ringtoneAudio.pause();
            ringtoneAudio.currentTime = 0;
        }
        incomingCallPanel.dataset.ringtone = '';
    }

    // Avatar ve kullanıcı adını ayarla
    const callAvatarElement = activeCallPanel.querySelector('.call-avatar');
    const callUsernameElement = activeCallPanel.querySelector('.call-username');
    const visualizerCanvas = activeCallPanel.querySelector('.voice-visualizer'); // Canvas'ı seç

    if (callAvatarElement) callAvatarElement.src = currentCallUserAvatar || 'images/DefaultAvatar.png';
    if (callUsernameElement) callUsernameElement.textContent = `${currentCallUsername} ile görüşülüyor`;

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

    // Görselleştiriciyi başlat
    if (visualizerCanvas && localStream) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Yerel akış için görselleştirici (her zaman aktif paneldeki canvas'ı kullanırız)
        localAnalyserNode = setupVisualizer(localStream, visualizerCanvas, audioContext, 'local');

        // Uzak akış zaten varsa, onu da aynı canvas'a bağlayabiliriz veya ayrı bir canvas.
        // Şimdilik, remote ontrack'te ayarlanacak.
        // Çizimi başlat
        drawVisualization(visualizerCanvas, localAnalyserNode, 'local'); // Başlangıçta sadece yerel için
    }
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

    // Görselleştirici animasyonunu durdur
    if (visualizerAnimationId) {
        cancelAnimationFrame(visualizerAnimationId);
        visualizerAnimationId = null;
    }
    // Analyser node'ları temizle
    if (localAnalyserNode) localAnalyserNode.disconnect();
    if (remoteAnalyserNode) remoteAnalyserNode.disconnect();
    localAnalyserNode = null;
    remoteAnalyserNode = null;
    // AudioContext'i kapatma, diğer aramalar için kullanılabilir
    stopRingingSound();
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

// Ses Görselleştirici Fonksiyonları
function setupVisualizer(stream, canvasElement, audioCtx, type) {
    if (!stream || !canvasElement || !audioCtx) {
        console.warn(`Görselleştirici için eksik parametreler (${type}):`, { stream, canvasElement, audioCtx });
        return null;
    }
    console.log(`🎙️ ${type} akışı için görselleştirici ayarlanıyor.`);

    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    // analyser.connect(audioCtx.destination); // Sesi tekrar çalmamak için bunu bağlamıyoruz, sadece analiz için.

    analyser.fftSize = 256; // Daha az detay, daha büyük çubuklar/dalga
    // analyser.smoothingTimeConstant = 0.85; // Daha yumuşak geçişler
    return analyser;
}

function drawVisualization(canvas, analyserNode, type) {
    if (!canvas || !analyserNode) {
        // console.warn(`Çizim için eksik parametreler (${type}):`, { canvas, analyserNode });
        if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId); // Eğer bir önceki animasyon varsa durdur
        return;
    }

    const canvasCtx = canvas.getContext('2d');
    const bufferLength = analyserNode.frequencyBinCount; // fftSize / 2
    const dataArray = new Uint8Array(bufferLength);

    // Canvas boyutlarını stil ile eşleştir (önemli!)
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10; // Kenarlardan 10px boşluk bırak

    function draw() {
        visualizerAnimationId = requestAnimationFrame(draw);

        analyserNode.getByteFrequencyData(dataArray); // Frekans verilerini al

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (2 * Math.PI * radius) / bufferLength * 0.8; // Barlar arası boşluk için 0.8 ile çarp
        let angle = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] * 0.5; // Yüksekliği biraz azaltalım

            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            const xEnd = centerX + (radius + barHeight) * Math.cos(angle);
            const yEnd = centerY + (radius + barHeight) * Math.sin(angle);

            canvasCtx.beginPath();
            canvasCtx.moveTo(x, y);
            canvasCtx.lineTo(xEnd, yEnd);

            // Renkleri ses şiddetine göre ayarla (örnek)
            const hue = i / bufferLength * 360; // Renk tekerleğinde dön
            // const saturation = '100%';
            // const lightness = Math.max(20, Math.min(80, barHeight * 0.8)) + '%'; // Parlaklığı ayarla
            // canvasCtx.strokeStyle = `hsl(${hue}, ${saturation}, ${lightness})`;

            // Veya sabit bir renk
            canvasCtx.strokeStyle = 'rgba(var(--primary-color-rgb), ' + Math.min(1, dataArray[i] / 255 + 0.2) + ')'; // Ana renk, opaklık sesle değişsin
            canvasCtx.lineWidth = barWidth;
            canvasCtx.stroke();

            angle += (2 * Math.PI) / bufferLength;
        }
    }
    draw();
}

// Ring sound functions
function initRingSound() {
    if (!callRingSound) {
        try {
            callRingSound = new Audio(RING_SOUND_PATH);
            callRingSound.loop = true;
        } catch (e) {
            console.error("Failed to initialize ring sound:", e);
            callRingSound = null; // Ensure it's null if initialization fails
        }
    }
}

function playRingingSound() {
    initRingSound();
    if (callRingSound && callRingSound.paused) {
        callRingSound.play().catch(e => console.error("Error playing ringing sound:", e));
    }
}

function stopRingingSound() {
    if (callRingSound && !callRingSound.paused) {
        callRingSound.pause();
        callRingSound.currentTime = 0;
    }
}

// Zil sesi için audio elementi
const ringtoneAudio = new Audio('sounds/ringtone.mp3');
ringtoneAudio.id = 'ringtoneAudio'; // ID ekleyelim
ringtoneAudio.loop = true;
document.body.appendChild(ringtoneAudio); // Sayfaya ekleyelim 