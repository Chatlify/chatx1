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
let audioContext = null; // Web Audio API için context
let audioProcessingNode = null; // Ses işleme için node
let rnNoiseProcessor = null; // RNNoise işlemcisi

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

// RNNoise için AudioWorklet işlemcisi
const RNNOISE_WORKLET_CODE = `
class RNNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 480; // RNNoise frame size
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // Zaman alanında gürültü bastırma için basit bir gürültü kapısı
    this.noiseGateThreshold = 0.01;
    this.smoothingFactor = 0.98;
    this.level = 0;
    
    // Port üzerinden mesajları dinle (gelecekte tam RNNoise WebAssembly implementasyonu için)
    this.port.onmessage = (event) => {
      if(event.data.type === 'setThreshold') {
        this.noiseGateThreshold = event.data.value;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (input.length === 0 || output.length === 0) return true;
    
    const inputChannel = input[0];
    const outputChannel = output[0];
    
    // Ses seviyesini hesapla ve ölç (smoothed RMS)
    let sum = 0;
    for (let i = 0; i < inputChannel.length; i++) {
      sum += inputChannel[i] * inputChannel[i];
    }
    let rms = Math.sqrt(sum / inputChannel.length);
    
    // Düzleştirme faktörü ile ses seviyesini güncelle
    this.level = this.smoothingFactor * this.level + (1 - this.smoothingFactor) * rms;
    
    // Basit gürültü kapısı
    let gainMultiplier = 1;
    if (this.level < this.noiseGateThreshold) {
      // Gürültü kapısı altında - sesi azalt
      gainMultiplier = 0.1;
    } else {
      // İnsan sesini geliştir - eşiğin üstünde
      gainMultiplier = 1.0;
    }
    
    // Sesi işleyip çıktıya gönder
    for (let i = 0; i < outputChannel.length; i++) {
      // Ses geliştirme: Düşük frekanslı sesleri artırıcı bir filtre
      // Ses örneklerini işleme
      outputChannel[i] = inputChannel[i] * gainMultiplier;
    }
    
    return true;
  }
}

registerProcessor('rnnoise-processor', RNNoiseProcessor);
`;

// ICE adaylarını geçici olarak saklayacak bir dizi oluştur
let pendingIceCandidates = [];

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

    // Web Audio API'yi hazırla
    prepareAudioProcessing();
}

// Web Audio API'yi hazırla
async function prepareAudioProcessing() {
    try {
        // AudioContext oluştur (lazy başlatma için null olarak bırakılabilir)
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });

        // İşlemci sınıfını kaydetme
        const blob = new Blob([RNNOISE_WORKLET_CODE], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);

        await audioContext.audioWorklet.addModule(workletUrl);
        console.log('📞 Ses işleme modülü başarıyla yüklendi');

        // URL'i serbest bırak
        URL.revokeObjectURL(workletUrl);
    } catch (error) {
        console.error('📞 Ses işleme modülü yüklenemedi:', error);
    }
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

// Ses filtreleme işlevi
async function applyNoiseSuppression(stream) {
    // SORUN: Ses filtreleme karşılıklı konuşmayı engelliyor
    // Şu an için filtrelemeyi atlayarak direkt akışı döndür
    console.log('📞 Ses filtreleme basitleştirildi - ham mikrofon akışı kullanılıyor');
    return stream;

    /* 
    // NOT: Bu kod şimdilik devre dışı bırakıldı
    // Ses işlemenin düzgün çalışmadığı tespit edildi
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
    }

    // Eğer ses işleme düğümü varsa önce onu durdur ve temizle
    if (audioProcessingNode) {
        audioProcessingNode.disconnect();
        audioProcessingNode = null;
    }

    try {
        // Ses akışı için kaynak oluştur
        const source = audioContext.createMediaStreamSource(stream);

        // İşlemcimizi oluştur
        audioProcessingNode = new AudioWorkletNode(audioContext, 'rnnoise-processor', {
            outputChannelCount: [1], // Mono çıkış
            processorOptions: {
                noiseGateThreshold: 0.01
            }
        });

        // İşlemci parametreleri ayarla
        audioProcessingNode.port.postMessage({
            type: 'setThreshold',
            value: 0.008 // Eşik değeri (daha düşük değer daha hassas gürültü bastırma)
        });

        // Ses işleme hattı oluştur: source -> işlemci -> çıkış
        source.connect(audioProcessingNode);

        // İşlenmiş ses için çıkış akışı oluştur
        const destination = audioContext.createMediaStreamDestination();
        audioProcessingNode.connect(destination);

        // İşlenmiş ses akışını döndür
        return destination.stream;
    } catch (error) {
        console.error('📞 Gürültü bastırma uygulanamadı:', error);
        return stream; // Hata durumunda orijinal akışı kullan
    }
    */
}

// Uzak ses akışına işlem uygula
async function applyRemoteAudioProcessing(stream) {
    // SORUN: Ses işleme sorunlara neden oluyor
    // Şu an için direkt akışı döndür
    console.log('📞 Uzak ses işleme basitleştirildi - ham ses akışı kullanılıyor');
    return stream;

    /* 
    // NOT: Bu kod şimdilik devre dışı bırakıldı
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: 48000
        });
    }

    try {
        // Ses akışı için kaynak oluştur
        const source = audioContext.createMediaStreamSource(stream);

        // Ses düzeyini daha iyi kontrol etmek için gain node oluştur
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 1.2; // Ses seviyesini hafifçe artır

        // Ses işleme hattı: source -> gain -> çıkış
        source.connect(gainNode);

        // İşlenmiş ses için çıkış akışı oluştur
        const destination = audioContext.createMediaStreamDestination();
        gainNode.connect(destination);

        return destination.stream;
    } catch (error) {
        console.error('📞 Uzak ses işleme uygulanamadı:', error);
        return stream; // Hata durumunda orijinal akışı kullan
    }
    */
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

        // Mikrofon erişimi iste - temel ayarlar
        const constraints = {
            audio: true,
            video: false
        };

        console.log('📞 Mikrofon erişimi isteniyor...');
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('📞 Mikrofon erişimi sağlandı:', localStream.getAudioTracks());

        // WebRTC bağlantısını kur
        createPeerConnection();
        console.log('📞 WebRTC bağlantısı kuruldu');

        // Ses akışını ekle
        localStream.getAudioTracks().forEach(track => {
            console.log('📞 Ses kanalı ekleniyor:', track.label, track.enabled, track.readyState);
            peerConnection.addTrack(track, localStream);
        });

        // SDP teklifini oluştur
        console.log('📞 Teklif oluşturuluyor...');
        const offerOptions = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        };

        const offer = await peerConnection.createOffer(offerOptions);
        console.log('📞 Yerel tanım ayarlanıyor:', offer);
        await peerConnection.setLocalDescription(offer);

        // Supabase üzerinden teklifi ilet
        console.log('📞 Teklif karşı tarafa gönderiliyor...');
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

            // Remote description ayarlandıktan sonra bekleyen ICE adaylarını ekle
            addPendingIceCandidates();
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

            // Remote description ayarlanmışsa adayı ekle, aksi takdirde kuyruğa al
            if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
                console.log('📞 ICE adayı başarıyla eklendi');
            } else {
                console.log('📞 Remote description henüz ayarlanmadı, ICE adayı kuyruğa alınıyor');
                pendingIceCandidates.push(signal.candidate);
            }
        } catch (error) {
            console.error('📞 ICE adayı eklenirken hata oluştu:', error);
        }
    }
}

// Bekleyen ICE adaylarını ekle
async function addPendingIceCandidates() {
    if (pendingIceCandidates.length === 0) return;

    console.log(`📞 ${pendingIceCandidates.length} bekleyen ICE adayı ekleniyor...`);

    for (const candidate of pendingIceCandidates) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('📞 Bekleyen ICE adayı eklenirken hata oluştu:', error);
        }
    }

    // Kuyruk temizlenir
    pendingIceCandidates = [];
}

// Uzak taraf aramayı sonlandırdığında
function handleRemoteHangup() {
    console.log('📞 Karşı taraf görüşmeyi sonlandırdı.');
    endCall();
}

// WebRTC bağlantısını oluştur
function createPeerConnection() {
    // Varolan bağlantıyı temizle
    if (peerConnection) {
        cleanupPeerConnection();
    }

    console.log('📞 Yeni WebRTC bağlantısını oluşturuyor...');

    // Özel konfigürasyonlar ile bağlantıyı oluştur
    const config = {
        ...iceServers,
        sdpSemantics: 'unified-plan',
        bundlePolicy: 'max-bundle',  // Tüm medya türlerini tek bir transport üzerinden gönder
        rtcpMuxPolicy: 'require',    // RTCP ve RTP'yi aynı port üzerinden gönder
        iceTransportPolicy: 'all',   // ICE vasıtasıyla tüm bağlantı yöntemlerini dene
        iceCandidatePoolSize: 2      // ICE aday havuzu boyutu (bağlantı kurulumunu hızlandırır)
    };

    // Yeni bağlantı oluştur
    peerConnection = new RTCPeerConnection(config);

    // Bekleyen ICE adayları dizisini temizle
    pendingIceCandidates = [];

    // ICE adayı alındığında
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log('📞 Yerel ICE adayı bulundu:', event.candidate);
            sendCallSignal({
                type: 'candidate',
                candidate: event.candidate
            }, currentCallUserId);
        } else {
            console.log('📞 ICE aday toplama işlemi tamamlandı.');
        }
    };

    // Bağlantı durumu değiştiğinde
    peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log('📞 ICE bağlantı durumu değişti:', state);

        // Bağlantı durumunu işle
        switch (state) {
            case 'connected':
            case 'completed':
                // Bağlantı kuruldu, arama aktif
                if (!isCallActive) {
                    console.log('📞 Sesli arama bağlantısı kuruldu!');
                    showActiveCallUI();
                }
                break;

            case 'failed':
                // Bağlantı kurulamadı, yeniden deneme
                console.log('📞 ICE bağlantısı başarısız oldu, yeniden deneniyor...');
                restartIce();
                break;

            case 'disconnected':
                // Geçici bağlantı kesintisi, bir süre bekle
                console.warn('📞 ICE bağlantısı kesintiye uğradı, yeniden bağlanmayı deniyor...');
                // 5 saniye içinde bağlantı düzelmezse aramayı sonlandır
                setTimeout(() => {
                    if (peerConnection && peerConnection.iceConnectionState === 'disconnected') {
                        console.error('📞 Bağlantı 5 saniye içinde düzelmedi, arama sonlandırılıyor.');
                        endCall();
                    }
                }, 5000);
                break;

            case 'closed':
                // Bağlantı kapatıldı
                if (isCallActive) {
                    console.log('📞 Bağlantı kapatıldı.');
                    endCall();
                }
                break;
        }
    };

    // Bağlantı toplama durumu değiştiğinde
    peerConnection.onicegatheringstatechange = () => {
        console.log('📞 ICE toplama durumu değişti:', peerConnection.iceGatheringState);
    };

    // Bağlantı durumu değiştiğinde
    peerConnection.onsignalingstatechange = () => {
        console.log('📞 Sinyal durumu değişti:', peerConnection.signalingState);

        // Bağlantı kapandıysa temizle
        if (peerConnection.signalingState === 'closed') {
            cleanupPeerConnection();
        }
    };

    // Uzak akış alındığında
    peerConnection.ontrack = (event) => {
        console.log('📞 Uzak ses akışı alındı:', event.streams[0]);

        // Mevcut ses elementini temizle
        const existingAudio = document.getElementById('remoteAudio');
        if (existingAudio) {
            existingAudio.srcObject = null;
            existingAudio.remove();
        }

        // Yeni ses elementi oluştur
        const remoteAudio = document.createElement('audio');
        remoteAudio.id = 'remoteAudio';
        remoteAudio.autoplay = true;
        remoteAudio.volume = 1.0; // Ses seviyesini maksimuma ayarla

        // Safari uyumluluğu için ek ayarlar
        remoteAudio.muted = false;
        remoteAudio.playsInline = true;

        // Ses elementine akışı doğrudan bağla (ses işleme olmadan)
        remoteAudio.srcObject = event.streams[0];
        document.body.appendChild(remoteAudio);

        // Oynatmayı zorla (Safari için)
        remoteAudio.play().catch(e =>
            console.warn('📞 Otomatik oynatma başlatılamadı:', e)
        );
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

        // Mikrofon erişimi iste - temel ayarlar
        const constraints = {
            audio: true,
            video: false
        };

        console.log('📞 Mikrofon erişimi isteniyor...');
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('📞 Mikrofon erişimi sağlandı:', localStream.getAudioTracks());

        // Gelen offer bilgisini al
        const offerStr = incomingCallPanel.dataset.offer;
        if (!offerStr) {
            throw new Error('Offer bilgisi bulunamadı');
        }

        const offer = JSON.parse(offerStr);

        // WebRTC bağlantısını kur
        createPeerConnection();
        console.log('📞 WebRTC bağlantısı kuruldu');

        // Ses akışını ekle
        localStream.getAudioTracks().forEach(track => {
            console.log('📞 Ses kanalı ekleniyor:', track.label, track.enabled, track.readyState);
            peerConnection.addTrack(track, localStream);
        });

        // Uzak tanımlamayı ayarla
        console.log('📞 Gelen teklif ayarlanıyor:', offer);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Cevap oluştur
        console.log('📞 Cevap oluşturuluyor...');
        const answer = await peerConnection.createAnswer();
        console.log('📞 Yerel tanım ayarlanıyor:', answer);
        await peerConnection.setLocalDescription(answer);

        // Cevabı gönder
        console.log('📞 Cevap karşı tarafa gönderiliyor...');
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

// Arama sırasında ses optimizasyonları uygula
function applyAudioOptimizations() {
    if (!peerConnection) return;

    // Sadece göndericiler üzerinde parametreleri ayarla
    peerConnection.getSenders().forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
            try {
                // Mevcut parametreleri al
                const parameters = sender.getParameters();

                // Audio bitrate ayarla (kaliteyi artır)
                if (parameters.encodings && parameters.encodings.length > 0) {
                    // Kaliteyi artır - 48kbps mono (daha yüksek kalite)
                    parameters.encodings[0].maxBitrate = 48000;
                    parameters.encodings[0].priority = 'high';

                    console.log('📞 Ses göndericisi parametreleri ayarlanıyor:', parameters);

                    // Değişiklikleri uygula
                    sender.setParameters(parameters).catch(e => {
                        console.warn('📞 Gönderici parametreleri güncellenemedi:', e);
                    });
                }
            } catch (error) {
                console.warn('📞 Ses parametreleri ayarlanamadı:', error);
            }
        }
    });

    // Ses kalitesini optimize etmek için yaptığımız diğer ayarlamalar
    try {
        // Stereo ve Echo Cancellation gibi ek özellikler
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                const constraints = {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1, // Mono ses
                    sampleRate: 48000 // Yüksek kalite
                };

                // Ses özelliklerini ayarla (eğer tarayıcı destekliyorsa)
                if (audioTrack.applyConstraints) {
                    audioTrack.applyConstraints(constraints).catch(e => {
                        console.warn('📞 Ses kısıtlamaları uygulanamadı:', e);
                    });
                }
            }
        }
    } catch (error) {
        console.warn('📞 Ses kalitesi optimizasyonu yapılamadı:', error);
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

    // Ses işleme düğümlerini temizle
    if (audioProcessingNode) {
        audioProcessingNode.disconnect();
        audioProcessingNode = null;
    }

    // Uzak ses elementi varsa kaldır
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
        remoteAudio.srcObject = null;
        remoteAudio.remove();
    }

    // WebRTC bağlantısını temizle
    cleanupPeerConnection();

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
}

// Sesli arama için hata kontrolü
export function checkVoiceCallSupport() {
    const hasWebRTC = !!window.RTCPeerConnection;
    const hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
    const hasAudioWorklet = hasAudioContext && 'audioWorklet' in (window.AudioContext || window.webkitAudioContext).prototype;
    const hasMediaDevices = !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;

    if (!hasWebRTC || !hasMediaDevices) {
        console.error('📞 WebRTC desteklenmiyor! Sesli arama kullanılamaz.');
        return false;
    }

    if (!hasAudioContext || !hasAudioWorklet) {
        console.warn('📞 AudioWorklet desteklenmiyor! Gelişmiş ses işleme özellikleri devre dışı bırakılacak.');
        // Bu durumda uygulamayı düşürebilir veya devam edebilirsiniz
        // Şimdilik devam edelim ve temel gürültü azaltma işlemini kullanmayalım
    }

    return true;
}

// ICE yeniden başlatma
async function restartIce() {
    if (!peerConnection || !isCallActive) return;

    try {
        console.log('📞 ICE yeniden başlatılıyor...');

        // ICE yeniden başlatma bayrağını ayarla
        const offerOptions = {
            iceRestart: true,
            voiceActivityDetection: true
        };

        // Yeni bir teklif oluştur
        if (isInitiator) {
            const offer = await peerConnection.createOffer(offerOptions);
            await peerConnection.setLocalDescription(offer);

            // Karşı tarafa yeni teklifi gönder
            sendCallSignal({
                type: 'offer',
                offer: peerConnection.localDescription
            }, currentCallUserId);
        }
    } catch (error) {
        console.error('📞 ICE yeniden başlatma hatası:', error);
    }
}

// Peer bağlantısı temizleme
function cleanupPeerConnection() {
    console.log('📞 WebRTC bağlantısı temizleniyor...');

    if (peerConnection) {
        // Tüm dinleyicileri kaldır
        peerConnection.onicecandidate = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onicegatheringstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.ontrack = null;

        // Tüm gönderici ve alıcıları temizle
        peerConnection.getSenders().forEach(sender => {
            if (sender.track) {
                sender.track.stop();
            }
        });

        // Bağlantıyı kapat
        peerConnection.close();
        peerConnection = null;
    }

    // Bekleyen ICE adaylarını temizle
    pendingIceCandidates = [];
} 