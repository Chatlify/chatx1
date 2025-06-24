import { supabase } from './auth_config.js';

// Toast stilleri
const toastStyles = `
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.toast {
    background-color: var(--primary-color);
    border-left: 4px solid var(--brand-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: var(--text-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 350px;
    min-width: 300px;
    padding: 12px 16px;
    transform: translateX(120%);
    transition: transform 0.3s ease;
    opacity: 0;
}

.toast.show {
    transform: translateX(0);
    opacity: 1;
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
}

.toast-content i {
    font-size: 20px;
}

.toast-success {
    border-left-color: #4CAF50;
}

.toast-success i {
    color: #4CAF50;
}

.toast-warning {
    border-left-color: #FF9800;
}

.toast-warning i {
    color: #FF9800;
}

.toast-error {
    border-left-color: #F44336;
}

.toast-error i {
    color: #F44336;
}

.toast-info {
    border-left-color: #2196F3;
}

.toast-info i {
    color: #2196F3;
}

.toast-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 16px;
    padding: 0;
    margin-left: 12px;
}

.toast-close:hover {
    color: var(--text-color);
}
`;

// Stil elementini oluştur ve ekle
const styleEl = document.createElement('style');
styleEl.textContent = toastStyles;
document.head.appendChild(styleEl);

// Global olarak erişilebilir sendFriendRequest fonksiyonu
window.sendFriendRequest = async function (username) {
    try {
        // Kullanıcı adını doğrudan kullan, etiket ayırma işlemini kaldırdık
        const targetUsername = username.trim();

        if (!targetUsername) {
            throw new Error('Geçersiz kullanıcı adı.');
        }

        // Kullanıcı oturumunu kontrol et
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            throw new Error('Oturum açmanız gerekiyor.');
        }

        // Hedef kullanıcıyı bul
        const { data: targetUsers, error: userError } = await supabase
            .from('profiles')
            .select('id, username')
            .eq('username', targetUsername)
            .limit(1);

        if (userError) {
            throw new Error('Kullanıcı aranırken bir hata oluştu.');
        }

        if (!targetUsers || targetUsers.length === 0) {
            throw new Error(`${targetUsername} adlı kullanıcı bulunamadı.`);
        }

        const targetUser = targetUsers[0];

        // Kendinize arkadaşlık isteği göndermeyi engelle
        if (targetUser.id === session.user.id) {
            throw new Error('Kendinize arkadaşlık isteği gönderemezsiniz.');
        }

        // Zaten arkadaş olup olmadığını kontrol et - İlk durum
        const { data: existingFriendship1, error: friendshipError1 } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id_1', session.user.id)
            .eq('user_id_2', targetUser.id)
            .eq('status', 'accepted');

        // Zaten arkadaş olup olmadığını kontrol et - İkinci durum
        const { data: existingFriendship2, error: friendshipError2 } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id_1', targetUser.id)
            .eq('user_id_2', session.user.id)
            .eq('status', 'accepted');

        if (friendshipError1 || friendshipError2) {
            console.error("Friendship error 1:", friendshipError1);
            console.error("Friendship error 2:", friendshipError2);
            throw new Error('Arkadaşlık durumu kontrol edilirken bir hata oluştu.');
        }

        // Her iki sorgunun sonuçlarını birleştir
        const existingFriendships = [
            ...(existingFriendship1 || []),
            ...(existingFriendship2 || [])
        ];

        if (existingFriendships.length > 0) {
            throw new Error(`${targetUsername} zaten arkadaş listenizde.`);
        }

        // Bekleyen bir istek olup olmadığını kontrol et - İlk durum
        const { data: pendingRequest1, error: pendingError1 } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id_1', session.user.id)
            .eq('user_id_2', targetUser.id)
            .eq('status', 'pending');

        // Bekleyen bir istek olup olmadığını kontrol et - İkinci durum
        const { data: pendingRequest2, error: pendingError2 } = await supabase
            .from('friendships')
            .select('*')
            .eq('user_id_1', targetUser.id)
            .eq('user_id_2', session.user.id)
            .eq('status', 'pending');

        if (pendingError1 || pendingError2) {
            console.error("Pending error 1:", pendingError1);
            console.error("Pending error 2:", pendingError2);
            throw new Error('Bekleyen istekler kontrol edilirken bir hata oluştu.');
        }

        // Her iki sorgunun sonuçlarını birleştir
        const pendingRequests = [
            ...(pendingRequest1 || []),
            ...(pendingRequest2 || [])
        ];

        if (pendingRequests.length > 0) {
            throw new Error(`${targetUsername} için zaten bekleyen bir arkadaşlık isteği var.`);
        }

        // Arkadaşlık isteği gönder
        const { data: friendship, error: insertError } = await supabase
            .from('friendships')
            .insert([
                {
                    user_id_1: session.user.id,
                    user_id_2: targetUser.id,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]);

        if (insertError) {
            console.error("Insert error:", insertError);
            throw new Error('Arkadaşlık isteği gönderilirken bir hata oluştu.');
        }

        return { success: true };
    } catch (error) {
        console.error('Arkadaşlık isteği gönderme hatası:', error);
        throw error;
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Supabase zaten import edildiği için tekrar initialize etmeye gerek yok
    // const supabase = supabaseInit(); - Bu satır hataya neden oluyordu

    // Cloudinary yapılandırması (JavaScript tarafında yükleme yapıyoruz)
    const CLOUDINARY_CLOUD_NAME = "dxr8bxvbp"; // Burayı kendi cloud name'inizle değiştirin
    const CLOUDINARY_UPLOAD_PRESET = "chatlify_users"; // Cloudinary panelindeki preset adı
    const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

    // --- 1. STATE MANAGEMENT ---
    const state = {
        currentUser: null,
        currentConversationId: null,
        messageSubscription: null, // Holds the current real-time subscription
        friends: [],
        onlineFriends: new Set(),
        presenceChannel: null,
        pendingRequests: [],
        activeFriendsTab: 'all', // 'all', 'online', 'pending'
        messages: [], // To hold current chat messages
        currentFriend: null,
        participants: {},
        activePanel: 'friends',
        lastHeartbeat: Date.now(), // Son heartbeat zamanını tutmak için
        isUploadingImage: false,   // Resim yükleme durumunu izlemek için
        uploadingImageElement: null // Yükleme göstergesini tutmak için
    };

    // --- 2. UI ELEMENTS ---
    const ui = {
        // Friend List & Panels
        friendsPanel: document.querySelector('.friends-panel-container'),
        sponsorServersContainer: document.querySelector('.right-sidebar-container'),
        friendsListContainer: document.querySelector('.friends-list-container'),
        onlineFriendsList: document.querySelector('.online-friends'),
        offlineFriendsList: document.querySelector('.offline-friends'),
        onlineCount: document.querySelector('.online-count'),
        offlineCount: document.querySelector('.offline-count'),

        // Main Content & Chat Panel
        mainContent: document.querySelector('.main-content'),
        chatPanel: document.querySelector('.main-content .chat-panel'),

        onlineSectionTitle: document.querySelector('.online-section-title'),
        offlineSectionTitle: document.querySelector('.offline-section-title'),
        pendingRequestsList: document.querySelector('.pending-requests-list'),
        pendingSectionTitle: document.querySelector('.pending-requests-section-title'),
        pendingCount: document.querySelector('.pending-requests-count'),
        dmList: document.querySelector('#friends-group .dm-items'),
        friendList: document.querySelector('.friend-list'),

        // Sidebar Toggle Butonu için eksik UI elemanları
        sidebarToggleButton: document.getElementById('sidebar-toggle-btn'),
        serverSidebar: document.querySelector('.server-sidebar'),
        dmSidebar: document.querySelector('.direct-messages'),

        // Sidebar Butonları
        settingsButton: document.querySelector('.sidebar-item[aria-label="Settings"]'),
        shopButton: document.querySelector('.sidebar-item[aria-label="Shop"]'),
        addServerButton: document.querySelector('.sidebar-item.add-server'),

        // Chat Panel
        chatActionBtn: document.querySelector('.chat-action-btn'),
        chatProfileBtn: document.querySelector('.chat-action-btn.profile-btn'),
        chatHeaderUser: document.querySelector('.chat-panel .chat-header-user'),
        chatMessages: document.querySelector('.chat-panel .chat-messages'),
        chatInput: document.querySelector('.chat-panel .chat-textbox textarea'),
        chatSendBtn: document.querySelector('.chat-panel .chat-send-btn'),
        chatCloseBtn: document.querySelector('.chat-panel .chat-close-btn'),

        // Profile Panel (The one that opens for friends)
        friendProfilePanel: document.querySelector('.friend-profile-panel'),
        friendProfileCloseBtn: document.querySelector('.friend-profile-panel .close-panel-btn'),
        friendProfileModalOverlay: document.querySelector('.friend-profile-modal-overlay'),

        // User Footer
        userFooter: document.querySelector('.dm-footer .dm-user'),
        userFooterName: document.querySelector('.dm-footer .dm-user-name'),
        userFooterAvatar: document.querySelector('.dm-footer .dm-user-avatar img'),

        // YENİ, YATAY MODAL YAPISI İÇİN
        profileModal: {
            container: document.getElementById('profile-modal-container'),
            closeBtn: document.querySelector('.profile-modal-close-btn'),
            // Sol Taraf
            avatar: document.querySelector('.profile-modal-left .profile-modal-avatar img'),
            statusDot: document.querySelector('.profile-modal-left .status-dot-modal'),
            username: document.querySelector('.profile-modal-left .username'),
            statusText: document.querySelector('.profile-modal-left .status-text'),
            // Sağ Taraf
            badgesContainer: document.querySelector('.profile-modal-right .badges-container'),
            bio: document.querySelector('.profile-modal-right .bio'),
            memberSince: document.querySelector('.profile-modal-right .member-since'),
        },
        // Arkadaş Ekle Modalı
        addFriendModal: {
            container: document.getElementById('add-friend-modal-container'),
            button: document.getElementById('add-friend-button'),
            // Bu elemanlar modal HTML'i yüklendikten sonra doldurulacak
            overlay: null,
            form: null,
            input: null,
            statusMessage: null,
            closeBtn: null,
        },
        friendsContentContainer: document.querySelector('.friends-content-container'),
        tabsContainer: document.querySelector('.tabs-container'),
        dashboardContainer: document.querySelector('.dashboard-container'),
    };

    // --- 3. SUPABASE SERVICE ---
    const supabaseService = {
        async getUserSession() {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error getting session:", error);
                return null;
            }
            if (!data.session) {
                window.location.href = '/login.html';
                return null;
            }
            return data.session.user;
        },

        async getUserProfile(userId) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) console.error(`Error fetching profile for ${userId}:`, error);
            return data;
        },

        async getFriends(userId) {
            const { data, error } = await supabase.rpc('get_friends_with_details', { user_id_input: userId });

            if (error) {
                console.error('Error fetching friends via RPC:', error);
                return [];
            }
            return data;
        },

        async getPendingRequests(userId) {
            const { data, error } = await supabase
                .from('friendships')
                .select('id, created_at, profiles:user_id_1(id, username, avatar_url)')
                .eq('user_id_2', userId)
                .eq('status', 'pending');

            if (error) {
                console.error('Error fetching pending requests:', error);
                return [];
            }

            return data.map(req => ({
                id: req.id,
                username: req.profiles.username,
                avatarUrl: req.profiles.avatar_url,
                createdAt: req.created_at,
            }));
        },

        async acceptFriendRequest(requestId) {
            const { error } = await supabase
                .from('friendships')
                .update({
                    status: 'accepted',
                    updated_at: new Date().toISOString()
                })
                .eq('id', requestId);

            if (error) {
                console.error('Error accepting friend request:', error);
                return { success: false, error };
            }
            console.log('Successfully accepted friend request in DB.');
            return { success: true };
        },

        async rejectFriendRequest(requestId) {
            console.log(`Rejecting friend request: ${requestId}`);
            const { error } = await supabase
                .from('friendships')
                .delete()
                .eq('id', requestId);

            if (error) {
                console.error('Error rejecting friend request:', error);
                return { success: false, error };
            }
            console.log('Successfully rejected friend request in DB.');
            return { success: true };
        },

        async getOrCreateConversation(userId1, userId2) {
            console.log(`[CONVERSATION] Getting or creating conversation between ${userId1} and ${userId2}`);

            // Kullanıcı ID'lerini her zaman aynı sırada (küçükten büyüğe) kullanarak
            // A->B ve B->A için aynı sohbeti bulmayı garantile.
            const sortedUserIds = [userId1, userId2].sort();
            const user_a = sortedUserIds[0];
            const user_b = sortedUserIds[1];

            try {
                // 1. İki kullanıcı arasında mevcut bir sohbet var mı diye kontrol et.
                // Bu RPC fonksiyonu, iki kullanıcının da bulunduğu ortak sohbetleri arar.
                const { data: existing, error: rpcError } = await supabase.rpc('get_conversation_between_users', {
                    user_a_id: user_a,
                    user_b_id: user_b
                });

                if (rpcError) {
                    console.error('[CONVERSATION] Error checking for existing conversation via RPC:', rpcError);
                    throw rpcError;
                }

                if (existing && existing.length > 0) {
                    const conversationId = existing[0].conversation_id;
                    console.log(`[CONVERSATION] Found existing conversation: ${conversationId}`);
                    return conversationId;
                }

                // 2. Mevcut sohbet yoksa, yeni bir tane oluştur.
                // Bu işlem için RLS sorunlarını güvenli bir şekilde aşan RPC fonksiyonunu kullan.
                console.log('[CONVERSATION] No existing conversation found, creating a new one via RPC.');

                // userId1 mevcut kullanıcı, userId2 ise diğer kullanıcıdır.
                const { data: newConversationId, error: createError } = await supabase.rpc('create_conversation_and_add_participants', {
                    other_user_id: userId2
                });

                if (createError) {
                    console.error('[CONVERSATION] Error creating conversation via RPC:', createError);
                    throw createError;
                }

                if (!newConversationId) {
                    throw new Error("RPC call did not return a new conversation ID.");
                }

                console.log(`[CONVERSATION] Successfully created new conversation via RPC: ${newConversationId}`);
                return newConversationId;

            } catch (error) {
                console.error('[CONVERSATION] Failed to get or create conversation:', error);
                // Kullanıcıya bir hata mesajı gösterilebilir.
                alert('Sohbet oluşturulurken kritik bir hata meydana geldi. Lütfen tekrar deneyin.');
                return null;
            }
        },

        async sendMessage(conversationId, senderId, content) {
            console.log(`[MESSAGE] Attempting to send message to conv ${conversationId}`);

            if (!content || !content.trim()) {
                console.error('[MESSAGE] Cannot send an empty message.');
                return { error: { message: "Mesaj içeriği boş olamaz." } };
            }

            try {
                const messageData = {
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: content.trim(),
                    contentType: 'text' // Varsayılan olarak 'text'
                };

                // Mesajı doğrudan 'messages' tablosuna ekle.
                // Bu, RLS politikaları doğru ayarlandığı için en güvenli ve standart yoldur.
                const { data, error } = await supabase
                    .from('messages')
                    .insert(messageData)
                    .select(`
                        *,
                        sender:profiles (
                            username,
                            avatar_url
                        )
                    `)
                    .single();

                if (error) {
                    console.error('[MESSAGE] Error inserting message directly:', error);
                    // RLS hatası olup olmadığını kontrol et
                    if (error.code === '42501') {
                        alert('Mesaj gönderilemedi. Güvenlik kuralları bu işlemi engelliyor. Lütfen sayfayı yenileyip tekrar deneyin.');
                    }
                    throw error;
                }

                console.log('[MESSAGE] Message sent successfully via direct insert:', data);
                return { data };

            } catch (error) {
                console.error('[MESSAGE] Final error in sendMessage:', error);
                return { error };
            }
        },

        async getMessages(conversationId) {
            try {
                // Önce doğrudan conversation_id ile sorgulayalım
                const { data, error } = await supabase
                    .from('messages')
                    .select(`
                        id, 
                        conversation_id, 
                        sender_id, 
                        content, 
                        contentType, 
                        createdAt,
                        profiles:sender_id (
                            username,
                            avatar_url
                        )
                    `)
                    .eq('conversation_id', conversationId)
                    .order('createdAt', { ascending: true });

                if (error) {
                    console.error(`Error fetching messages for conversation ${conversationId}:`, error);

                    // Doğrudan sorgu başarısız olursa, RPC ile deneyelim
                    console.log('Direct query failed, trying RPC');
                    return await this.getMessagesViaRPC(conversationId);
                }

                console.log('Retrieved messages from database:', data);

                // Eğer hiç mesaj yoksa, RPC kullanarak deneyelim
                if (!data || data.length === 0) {
                    console.log('No messages found with direct query, trying RPC');
                    return await this.getMessagesViaRPC(conversationId);
                }

                // Dönen veriyi UI için uygun formata dönüştür
                const formattedMessages = data.map(msg => ({
                    id: msg.id,
                    conversation_id: msg.conversation_id,
                    sender_id: msg.sender_id,
                    content: msg.content,
                    contentType: msg.contentType,
                    createdAt: msg.createdAt,
                    sender: {
                        username: msg.profiles?.username || 'Kullanıcı',
                        avatar_url: msg.profiles?.avatar_url || 'images/defaultavatar.png'
                    }
                }));

                return formattedMessages;
            } catch (error) {
                console.error(`Error fetching messages for conversation ${conversationId}:`, error);
                return [];
            }
        },

        // RPC kullanarak mesajları getir
        async getMessagesViaRPC(conversationId) {
            try {
                console.log('Fetching messages via RPC for conversation:', conversationId);

                // RPC kullanarak mesajları alalım
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_conversation_messages', {
                    conv_id: conversationId
                });

                if (rpcError) {
                    console.error(`Error fetching messages with RPC for conversation ${conversationId}:`, rpcError);
                    return [];
                }

                console.log('Retrieved messages via RPC:', rpcData);

                if (rpcData && rpcData.length > 0) {
                    // RPC'den gelen verileri formatlayalım - sütun adlarına dikkat et!
                    const formattedMessages = rpcData.map(msg => {
                        console.log('Processing message from RPC:', msg);
                        return {
                            id: msg.id || msg.message_id, // Sütun adı değişebilir
                            conversation_id: msg.conversation_id || msg.conv_id,
                            sender_id: msg.sender_id || msg.sender,
                            content: msg.content || msg.msg_content,
                            contentType: msg.contentType || msg.content_type || 'text',
                            createdAt: msg.createdAt || msg.created_at || new Date().toISOString(),
                            sender: {
                                username: msg.sender_username || msg.username || 'Kullanıcı',
                                avatar_url: msg.sender_avatar_url || msg.avatar_url || 'images/defaultavatar.png'
                            }
                        };
                    });

                    return formattedMessages;
                }

                return [];
            } catch (error) {
                console.error(`Error in getMessagesViaRPC for conversation ${conversationId}:`, error);
                return [];
            }
        },

        async sendFriendRequestByUsername(username) {
            // ... mevcut kod ...
        },

        // Realtime mesajlaşma için subscription oluştur
        setupMessageSubscription(conversationId) {
            // BU FONKSİYON ARTIK TEMİZLİK YAPMIYOR. Sadece yeni abonelik oluşturmaktan sorumlu.
            console.log(`[Sub] Setting up NEW message subscription for conversation: ${conversationId}`);

            // Kanal ismi formatı çok önemli, Supabase'in beklediği formata uygun olmalı
            const channelName = `messages:${conversationId}`;
            const channel = supabase.channel(channelName);

            channel.on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('[Sub] Received payload:', payload);
                    const newMessage = payload.new;

                    // 1. KENDİ MESAJINI ENGELLE (ÇİFTLENMEYİ ÖNLER)
                    if (newMessage.sender_id === state.currentUser.id) {
                        console.log('[Sub] Received own message, ignoring to prevent duplication.');
                        return;
                    }

                    // 2. GÖNDEREN BİLGİSİNİ EKLE (KULLANICI ADI KAYBOLMASINI ENGELLER)
                    const senderProfile = state.participants[newMessage.sender_id];
                    newMessage.sender = senderProfile || { username: 'Bilinmeyen Kullanıcı', avatar_url: 'images/defaultavatar.png' };

                    // Eğer mesaj zaten ekranda varsa (çok nadir bir durum), tekrar ekleme
                    if (document.querySelector(`[data-message-id="${newMessage.id}"]`)) {
                        console.log(`[Sub] Message with ID ${newMessage.id} already exists. Skipping render.`);
                        return;
                    }

                    // Mesajı state'e ve ekrana ekle
                    state.messages.push(newMessage);
                    renderer.renderMessages(state.messages);
                }
            ).subscribe((status, err) => {
                // Abonelik durumunu daha detaylı logla
                switch (status) {
                    case 'SUBSCRIBED':
                        console.log(`[Sub] Successfully subscribed to channel for conversation ${conversationId}`);
                        break;
                    case 'TIMED_OUT':
                        console.warn('[Sub] Subscription timed out. The connection was lost.');
                        break;
                    case 'CHANNEL_ERROR':
                        console.error('[Sub] Channel error:', err);

                        // Hata durumunda kanalı yeniden bağlamayı dene
                        if (state.messageSubscription) {
                            console.log('[Sub] Attempting to reconnect channel...');
                            setTimeout(() => {
                                cleanupChatState();
                                this.setupMessageSubscription(conversationId);
                            }, 2000);
                        }
                        break;
                    case 'CLOSED':
                        console.log('[Sub] Subscription channel closed.');
                        break;
                }
            });

            // Yeni aboneliği state'e kaydet
            state.messageSubscription = channel;
        },
    };

    // --- 4. UI RENDERER ---
    const renderer = {
        render() {
            // Update active tab UI
            ui.tabsContainer.querySelectorAll('.tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === state.activeFriendsTab);
            });

            // Render content based on active tab
            switch (state.activeFriendsTab) {
                case 'all':
                case 'online':
                    this.renderFriendCards();
                    break;
                case 'pending':
                    this.renderPendingRequestCards();
                    break;
                default:
                    ui.friendsContentContainer.innerHTML = '';
            }
        },

        renderFriendCards() {
            const { friends, onlineFriends, activeFriendsTab } = state;
            let friendsToRender = friends;

            if (activeFriendsTab === 'online') {
                friendsToRender = friends.filter(f => onlineFriends.has(f.id));
            }

            if (friendsToRender.length === 0) {
                const message = activeFriendsTab === 'online'
                    ? 'Kimse aktif değil gibi görünüyor.'
                    : 'Henüz hiç arkadaşın yok. Birilerini eklemeye ne dersin?';
                ui.friendsContentContainer.innerHTML = `<div class="empty-state"><i class="fas fa-ghost"></i><p>${message}</p></div>`;
                return;
            }

            const gridHTML = friendsToRender.map(friend => {
                const isOnline = onlineFriends.has(friend.id);
                const statusText = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
                const statusClass = isOnline ? 'online' : 'offline';

                return `
                    <div class="friend-card" data-user-id="${friend.id}">
                        <div class="card-banner" data-action="profile"></div>
                        <div class="card-avatar" data-action="profile">
                            <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}'s avatar">
                            <div class="status-dot ${statusClass}" title="${statusText}"></div>
                        </div>
                        <div class="card-username" data-action="profile">${friend.username}</div>
                        <div class="card-status" data-action="profile">${statusText}</div>
                        <div class="card-actions">
                            <button class="card-action-btn message-btn" title="Mesaj Gönder" data-action="message">
                                <i class="fas fa-comment-dots"></i>
                            </button>
                            <button class="card-action-btn call-btn" title="Sesli Arama" data-action="call">
                                <i class="fas fa-phone-alt"></i>
                            </button>
                            <button class="card-action-btn profile-btn" title="Profil" data-action="profile">
                                <i class="fas fa-user"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            ui.friendsContentContainer.innerHTML = `<div class="friends-grid">${gridHTML}</div>`;
        },

        renderPendingRequestCards() {
            console.log('[RENDER] Rendering pending friend requests');
            const { pendingRequests } = state;

            if (!pendingRequests || pendingRequests.length === 0) {
                ui.friendsContentContainer.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>Bekleyen arkadaşlık isteğin yok. Yeni arkadaşlar eklemek için "Arkadaş Ekle" butonunu kullanabilirsin.</p>
                    </div>
                `;
                return;
            }

            // Bekleyen isteklerin sayısını göster
            const requestCount = pendingRequests.length;
            console.log(`[RENDER] Found ${requestCount} pending requests`);

            const requestsHTML = pendingRequests.map(req => {
                // İstek tarihi formatı
                let requestTime = '';
                try {
                    const date = new Date(req.createdAt);
                    requestTime = date.toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long'
                    });
                } catch (e) {
                    console.warn('[RENDER] Error formatting request date:', e);
                    requestTime = 'Bilinmeyen tarih';
                }

                return `
                <div class="request-card" data-request-id="${req.id}">
                    <div class="request-card-info">
                        <img src="${req.avatarUrl || 'images/defaultavatar.png'}" alt="${req.username}'s avatar">
                            <div class="user-details">
                                <span class="username">${req.username}</span>
                                <span class="request-time">${requestTime} tarihinde istek gönderdi</span>
                            </div>
                    </div>
                    <div class="request-card-actions">
                            <button class="accept-btn" title="Kabul Et">
                                <i class="fas fa-check"></i> Kabul Et
                            </button>
                            <button class="reject-btn" title="Reddet">
                                <i class="fas fa-times"></i> Reddet
                            </button>
                    </div>
                </div>
                `;
            }).join('');

            ui.friendsContentContainer.innerHTML = `
                <div class="pending-requests-header">
                    <h3><i class="fas fa-user-clock"></i> Bekleyen İstekler (${requestCount})</h3>
                </div>
                <div class="pending-requests-container">${requestsHTML}</div>
            `;
        },

        renderUserFooter(profile) {
            const { userFooterName, userFooterAvatar } = ui;
            if (!profile) return;

            // UI elementlerini seçelim
            const dmUserName = document.querySelector('.dm-user-name');
            const dmUserAvatar = document.querySelector('.dm-user-avatar img');
            const dmUserStatus = document.querySelector('.dm-user-status');
            const dmStatusDot = document.querySelector('.dm-user-avatar .dm-status');

            if (dmUserName) dmUserName.textContent = profile.username || 'Kullanıcı';
            if (dmUserAvatar) dmUserAvatar.src = profile.avatar_url || 'images/defaultavatar.png';

            // Durum bilgisini ayarla - her zaman aktif yerine gerçek durumunu göster
            // Ancak eğer mevcut kullanıcıysa, her zaman çevrimiçi göster
            const isCurrentUser = state.currentUser && profile.id === state.currentUser.id;
            const isOnline = isCurrentUser || state.onlineFriends.has(profile.id);

            if (dmUserStatus) dmUserStatus.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';

            // Durum noktasını güncelle
            if (dmStatusDot) {
                dmStatusDot.className = 'dm-status';
                if (isOnline) dmStatusDot.classList.add('online');
            }
        },

        renderDirectMessagesList() {
            const { friends, onlineFriends } = state;
            const { dmList } = ui;
            dmList.innerHTML = ''; // Clear previous list

            if (friends.length === 0) {
                dmList.innerHTML = '<li class="dm-item-empty" style="padding: 10px 15px; color: var(--text-muted);">Sohbet edecek kimse yok.</li>';
                return;
            }

            const friendsHTML = friends.map(friend => {
                const isOnline = onlineFriends.has(friend.id);
                return `
                    <li class="dm-item" data-user-id="${friend.id}" title="${friend.username}">
                        <div class="dm-item-avatar">
                            <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}'s avatar">
                            <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                        </div>
                        <span class="dm-item-name">${friend.username}</span>
                    </li>
                `;
            }).join('');

            dmList.innerHTML = friendsHTML;
        },

        renderMessages(messages) {
            console.log('[RENDER] Starting to render messages:', messages);

            // Mesaj konteynerini kontrol et
            if (!ui.chatMessages) {
                console.error('[RENDER] Chat messages container not found!');
                return;
            }

            ui.chatMessages.innerHTML = ''; // Önce temizle

            if (!messages || messages.length === 0) {
                console.log('[RENDER] No messages to render');
                return;
            }

            messages.forEach(msg => {
                const messageElement = this.createMessageElement(msg);
                if (messageElement) {
                    ui.chatMessages.appendChild(messageElement);
                }
            });

            console.log('[RENDER] All messages rendered successfully');
            this.scrollToBottom(); // Her render sonrası en alta kaydır
        },

        createMessageElement(msg) {
            if (!msg || !msg.sender_id || !msg.content) {
                console.warn('[RENDER] Invalid message object:', msg);
                return null;
            }

            const isOwnMessage = msg.sender_id === state.currentUser.id;
            const sender = msg.sender || (isOwnMessage ? state.currentUser : state.participants[msg.sender_id]);

            if (!sender) {
                console.warn(`[RENDER] Could not find sender profile for sender_id: ${msg.sender_id}`);
            }

            const author = sender?.username || 'Kullanıcı';
            const avatarUrl = sender?.avatar_url || 'images/defaultavatar.png';

            const messageElement = document.createElement('div');
            messageElement.className = `message-group ${isOwnMessage ? 'own-message' : ''}`;
            messageElement.dataset.messageId = msg.id;

            let time = '...';
            if (msg.createdAt) {
                try {
                    time = new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                } catch (e) { /* no-op */ }
            }

            const messageHTML = `
                ${!isOwnMessage ? `
                    <div class="message-group-avatar">
                        <img src="${avatarUrl}" alt="${author}">
                    </div>` : ''
                }
                <div class="message-group-content">
                    <div class="message-group-header">
                        ${!isOwnMessage ? `<span class="message-author">${author}</span>` : ''}
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content">
                        <p>${msg.content}</p>
                    </div>
                </div>
            `;

            messageElement.innerHTML = messageHTML;
            return messageElement;
        },

        showChatPanel(friend, conversationId) {
            console.log(`[CHAT] Showing chat panel for friend: ${friend.username}`);

            // YENİ VE ÖNEMLİ: Yeni bir sohbet göstermeden önce, eskisini tamamen temizle.
            cleanupChatState();

            const { chatPanel, chatHeaderUser, dashboardContainer } = ui;

            if (!dashboardContainer || !chatPanel) {
                console.error("[CHAT] Critical UI element not found!");
                return;
            }

            // Aşağı kaydırma butonu ekle
            this.setupScrollDownButton();

            // Katılımcı profillerini hafızaya al
            state.participants = {
                [state.currentUser.id]: state.currentUser,
                [friend.id]: friend,
            };
            console.log('[CHAT] Participants cached:', state.participants);

            if (state.messageSubscription) {
                state.messageSubscription.unsubscribe();
                state.messageSubscription = null;
            }

            // Başlığı arkadaş bilgileriyle güncelle
            if (chatHeaderUser) {
                const usernameEl = chatHeaderUser.querySelector('.chat-username');
                const avatarEl = chatHeaderUser.querySelector('.chat-avatar img');
                const statusEl = chatHeaderUser.querySelector('.chat-status');

                if (usernameEl) usernameEl.textContent = friend.username;
                if (avatarEl) avatarEl.src = friend.avatar_url || 'images/defaultavatar.png';
                if (statusEl) {
                    const isOnline = state.onlineFriends.has(friend.id);
                    statusEl.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
                    statusEl.className = `chat-status ${isOnline ? 'online' : 'offline'}`;
                }
            }

            // Durumu güncelle
            state.currentConversationId = conversationId;
            state.currentFriend = friend;

            // Önceki mesajları temizle ve yükleniyor mesajını göster
            if (ui.chatMessages) {
                ui.chatMessages.innerHTML = `
                    <div class="loading-messages">
                        <div class="spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                        </div>
                        <p>Mesajlar yükleniyor...</p>
                    </div>
                `;
            }

            // Mesajları getir ve göster
            this.fetchAndRenderMessages(conversationId);

            // Realtime mesaj aboneliği kur
            state.messageSubscription = supabaseService.setupMessageSubscription(conversationId);

            // Dashboard'a 'chat-active' sınıfını ekleyerek tüm CSS değişikliklerini tetikle
            dashboardContainer.classList.add('chat-active');

            // 'hidden' sınıfını sohbet panelinden kaldır
            chatPanel.classList.remove('hidden');

            // Metin kutusuna odaklan
            if (ui.chatInput) {
                setTimeout(() => {
                    ui.chatInput.focus();
                }, 300);
            }
        },

        // Mesajları getir ve göster (ayrı bir fonksiyon olarak)
        async fetchAndRenderMessages(conversationId) {
            console.log(`[CHAT] Fetching messages for conversation: ${conversationId}`);

            try {
                // Önce normal sorgu ile deneyelim
                const messages = await supabaseService.getMessages(conversationId);
                console.log(`[CHAT] Retrieved ${messages.length} messages`);

                // Mesajları state'e kaydet
                state.messages = messages;

                // Mesajları göster
                if (messages.length > 0) {
                    this.renderMessages(messages);
                } else if (ui.chatMessages && state.currentFriend) {
                    // Mesaj yoksa boş durum göster
                    ui.chatMessages.innerHTML = `
                        <div class="empty-state">
                            <p>${state.currentFriend.username} ile sohbetinize başlayın!</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('[CHAT] Error fetching messages:', error);
                if (ui.chatMessages) {
                    ui.chatMessages.innerHTML = `
                        <div class="error-state">
                            <p>Mesajlar yüklenirken bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.</p>
                        </div>
                    `;
                }
            }
        },

        hideChatPanel() {
            console.log('[UI] Hiding chat panel.');
            const { dashboardContainer, chatMessages, chatHeaderUser } = ui;

            if (dashboardContainer) {
                dashboardContainer.classList.remove('chat-active');
            }

            // Merkezi temizlik fonksiyonunu çağır.
            cleanupChatState();

            // Panel içeriğini temizle
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            if (chatHeaderUser) {
                chatHeaderUser.innerHTML = `
                    <div class="chat-avatar"><img src="images/defaultavatar.png" alt="default"></div>
                    <div class="chat-user-info">
                        <div class="chat-username">Sohbet Seçin</div>
                    </div>`;
            }
        },

        // --- HELPER FUNCTIONS ---
        scrollToBottom(smooth = true) {
            if (ui.chatMessages) {
                // Hafif bir gecikme, DOM'un güncellenmesine izin verir
                setTimeout(() => {
                    if (smooth) {
                        ui.chatMessages.scrollTo({
                            top: ui.chatMessages.scrollHeight,
                            behavior: 'smooth'
                        });
                    } else {
                        ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
                    }
                }, 50);
            }
        },

        // Belirli bir mesaja kaydır
        scrollToMessage(messageId) {
            if (ui.chatMessages) {
                const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
                if (messageElement) {
                    setTimeout(() => {
                        messageElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });

                        // Vurgu efekti ekle
                        messageElement.classList.add('highlight-message');
                        setTimeout(() => {
                            messageElement.classList.remove('highlight-message');
                        }, 2000);
                    }, 100);
                }
            }
        },

        // Aşağı kaydırma butonu ekle ve kaydırma olaylarını izle
        setupScrollDownButton() {
            if (!ui.chatPanel) return;

            // Varsa önceki butonu kaldır
            const existingBtn = document.querySelector('.scroll-down-btn');
            if (existingBtn) existingBtn.remove();

            // Yeni aşağı kaydırma butonu oluştur
            const scrollDownBtn = document.createElement('div');
            scrollDownBtn.className = 'scroll-down-btn';
            scrollDownBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
            scrollDownBtn.addEventListener('click', () => this.scrollToBottom(true));

            // Butonu chat paneline ekle
            ui.chatPanel.appendChild(scrollDownBtn);

            // Kaydırma olaylarını izle
            if (ui.chatMessages) {
                ui.chatMessages.addEventListener('scroll', () => {
                    const { scrollTop, scrollHeight, clientHeight } = ui.chatMessages;
                    // En aşağıdan 200px yukarıdaysak butonu göster
                    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

                    if (!isNearBottom) {
                        scrollDownBtn.classList.add('visible');
                    } else {
                        scrollDownBtn.classList.remove('visible');
                    }
                });

                // Yeni mesaj geldiğinde kaydırma pozisyonunu kontrol et
                const checkScroll = () => {
                    const { scrollTop, scrollHeight, clientHeight } = ui.chatMessages;
                    // Kullanıcı mesajı okuyorsa (aşağıda değilse) otomatik kaydırma
                    const shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 200;

                    if (shouldAutoScroll) {
                        this.scrollToBottom(true);
                    }
                };

                // chatMessages'e bir MutationObserver ekleyerek yeni mesaj geldiğini izle
                const observer = new MutationObserver(checkScroll);
                observer.observe(ui.chatMessages, { childList: true, subtree: true });
            }
        },
    };

    /**
     * Sohbetle ilgili tüm state'i ve realtime kanalını temizler.
     * Bu, sohbet kapatıldığında veya yeni bir sohbete geçildiğinde çağrılır.
     */
    function cleanupChatState() {
        console.log('[CLEANUP] Cleaning up chat state and channel.');
        if (state.messageSubscription) {
            try {
                console.log(`[CLEANUP] Removing channel: ${state.messageSubscription.topic}`);

                // Önce kanaldan abone olmayı bırak
                state.messageSubscription.unsubscribe()
                    .then(() => {
                        console.log('[CLEANUP] Successfully unsubscribed from channel');

                        // Sonra kanalı Supabase'den tamamen kaldır
                        return supabase.removeChannel(state.messageSubscription);
                    })
                    .then(status => {
                        console.log(`[CLEANUP] Channel removal status: ${status}`);
                    })
                    .catch(error => {
                        console.error('[CLEANUP] Error during channel cleanup:', error);
                    });
            } catch (error) {
                console.error('[CLEANUP] Error during channel cleanup:', error);
            } finally {
                // Her durumda state'den kanalı temizle
                state.messageSubscription = null;
            }
        }

        // State'i sıfırla
        state.currentConversationId = null;
        state.messages = [];
        state.participants = {};
        console.log('[CLEANUP] State has been reset.');
    }

    // --- 5. EVENT HANDLERS ---
    const handleTabClick = (e) => {
        const tab = e.target.closest('.tab');
        if (!tab) return;

        // Tüm tabları pasif yap
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Tıklanan tabı aktif yap
        tab.classList.add('active');

        // İlgili içeriği göster (data-tab attribute'una göre)
        const selectedTab = tab.dataset.tab;
        console.log(`Selected tab: ${selectedTab}`);
        // Update state to reflect active tab
        state.activeFriendsTab = selectedTab;

        // Seçilen tab'a göre içeriği güncelle
        renderer.render();
    };

    async function handleDmItemClick(e) {
        const dmItem = e.target.closest('.dm-item');
        if (!dmItem) return;

        const userId = dmItem.dataset.userId;
        if (!userId) {
            console.error('DM item does not have a user ID');
            return;
        }

        const friend = state.friends.find(f => f.id === userId);
        if (!friend) {
            console.error(`Friend with ID ${userId} not found in state`);
            return;
        }

        // Konuşma ID'sini al veya oluştur
        const conversationId = await supabaseService.getOrCreateConversation(state.currentUser.id, userId);
        if (conversationId) {
            renderer.showChatPanel(friend, conversationId);
        }
    }

    const handlePendingRequestAction = async (e) => {
        // Tıklanan butonun accept-btn veya reject-btn sınıfına sahip olup olmadığını kontrol et
        const acceptBtn = e.target.closest('.accept-btn');
        const rejectBtn = e.target.closest('.reject-btn');

        if (!acceptBtn && !rejectBtn) {
            return; // Buton tıklaması değil, çık
        }

        // İstek kartını bul
        const requestCard = e.target.closest('.request-card');
        if (!requestCard) {
            console.error('[FRIEND REQUEST] Request card not found for action button');
            return;
        }

        // İstek ID'sini al
        const requestId = parseInt(requestCard.dataset.requestId, 10);
        if (isNaN(requestId)) {
            console.error('[FRIEND REQUEST] Invalid request ID:', requestCard.dataset.requestId);
            return;
        }

        console.log(`[FRIEND REQUEST] Processing action for request ID: ${requestId}, action: ${acceptBtn ? 'accept' : 'reject'}`);

        // Tüm butonları devre dışı bırak ve işlem göstergesini ekle
        const buttons = requestCard.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('processing');
        });

        try {
            // İşlemi gerçekleştir
            let result;
            if (acceptBtn) {
                result = await supabaseService.acceptFriendRequest(requestId);
            } else {
                result = await supabaseService.rejectFriendRequest(requestId);
            }

            if (!result.success) {
                console.error('[FRIEND REQUEST] Action failed:', result.error);
                alert("İşlem sırasında bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");

                // Hata durumunda butonları tekrar etkinleştir
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('processing');
                });
            } else {
                console.log('[FRIEND REQUEST] Action successful:', acceptBtn ? 'accepted' : 'rejected');

                // İşlem başarılı olduğunda animasyon ekle
                requestCard.style.transition = 'all 0.5s ease';

                if (acceptBtn) {
                    requestCard.style.backgroundColor = 'rgba(67, 181, 129, 0.1)';
                    requestCard.style.borderColor = 'var(--success-color)';

                    // Kabul edildi mesajını göster
                    const actionsDiv = requestCard.querySelector('.request-card-actions');
                    actionsDiv.innerHTML = '<div class="action-success"><i class="fas fa-check-circle"></i> Arkadaşlık isteği kabul edildi</div>';

                    // Kısa bir süre sonra tüm arkadaşlar sekmesine geç
                    setTimeout(() => {
                        state.activeFriendsTab = 'all';
                        fetchAndRenderAll(); // Tüm verileri yeniden çek ve render et
                    }, 1500);
                } else {
                    requestCard.style.backgroundColor = 'rgba(240, 71, 71, 0.1)';
                    requestCard.style.borderColor = 'var(--danger-color)';

                    // Reddedildi mesajını göster
                    const actionsDiv = requestCard.querySelector('.request-card-actions');
                    actionsDiv.innerHTML = '<div class="action-success"><i class="fas fa-times-circle"></i> Arkadaşlık isteği reddedildi</div>';

                    // Kısa bir süre sonra kartı kaldır
                    setTimeout(() => {
                        requestCard.style.opacity = '0';
                        requestCard.style.height = '0';
                        requestCard.style.margin = '0';
                        requestCard.style.padding = '0';
                        requestCard.style.overflow = 'hidden';

                        setTimeout(() => {
                            // Tüm bekleyen istekleri yeniden render et
                            fetchAndRenderAll();
                        }, 500);
                    }, 1500);
                }
            }
        } catch (error) {
            console.error('[FRIEND REQUEST] Unexpected error:', error);
            alert("Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");

            // Hata durumunda butonları tekrar etkinleştir
            buttons.forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('processing');
            });
        }
    };

    // --- 6. INITIALIZATION & HELPERS ---
    async function fetchAndRenderAll() {
        try {
            const session = await supabaseService.getUserSession();
            if (!session) {
                console.log("No active session. Redirecting to login.");
                window.location.href = '/login.html'; // Redirect if no session
                return;
            }

            // 2. Fetch full user profile and merge into state
            const userProfile = await supabaseService.getUserProfile(session.id);
            state.currentUser = { ...session, ...userProfile }; // Important: merge profile data
            console.log('[INIT] Current user loaded:', state.currentUser);

            renderer.renderUserFooter(state.currentUser);

            // 3. Fetch and render all data
            state.friends = (await supabaseService.getFriends(state.currentUser.id)) || [];
            state.pendingRequests = (await supabaseService.getPendingRequests(state.currentUser.id)) || [];

            renderer.render();

            console.log("Tüm veriler başarıyla yüklendi ve render edildi.");

        } catch (error) {
            console.error('Veri yükleme ve render etme sırasında hata:', error);
        }
    }

    function updateNotificationBadge(userId, count) {
        // State'i güncelle
        if (count <= 0) {
            delete state.unreadMessages[userId];
        } else {
            state.unreadMessages[userId] = count;
        }

        // DOM'u güncelle
        const dmItem = document.querySelector(`.dm-item[data-user-id="${userId}"]`);
        if (!dmItem) return;

        const badge = dmItem.querySelector('.dm-notification-badge');
        if (!badge) return;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.classList.add('visible');
        } else {
            badge.classList.remove('visible');
        }
    }

    function subscribeToAllConversations(conversationIds) {
        console.log(`[NOTIFICATIONS] Subscribing to ${conversationIds.length} conversations for notifications.`);

        conversationIds.forEach(convoId => {
            const channel = supabase.channel(`notifications:${convoId}`);

            channel.on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${convoId}`
            }, payload => {
                const newMessage = payload.new;
                console.log(`[NOTIFICATIONS] New message detected in convo ${convoId}`, newMessage);

                // Kendine bildirim gönderme
                if (newMessage.sender_id === state.currentUser.id) {
                    return;
                }

                // Eğer sohbet zaten açıksa bildirim gönderme
                if (state.currentConversationId === newMessage.conversation_id) {
                    return;
                }

                // Bildirim sayısını artır
                const currentCount = state.unreadMessages[newMessage.sender_id] || 0;
                updateNotificationBadge(newMessage.sender_id, currentCount + 1);

                // Arkadaş listesini yeniden render et (rozetin görünmesi için)
                renderer.renderDirectMessagesList();
            })
                .subscribe(status => {
                    if (status === 'SUBSCRIBED') {
                        // console.log(`[NOTIFICATIONS] Successfully subscribed to convo ${convoId}`);
                    } else {
                        console.warn(`[NOTIFICATIONS] Subscription to ${convoId} failed with status: ${status}`);
                    }
                });
        });
    }

    const init = async () => {
        try {
            // 1. Get User Session First
            const sessionUser = await supabaseService.getUserSession();
            if (!sessionUser) {
                console.log("No active session. Redirecting to login.");
                window.location.href = '/login.html'; // Redirect if no session
                return;
            }

            // 2. Fetch full user profile and merge into state
            const userProfile = await supabaseService.getUserProfile(sessionUser.id);
            state.currentUser = { ...sessionUser, ...userProfile };
            console.log('[INIT] Current user loaded:', state.currentUser);

            renderer.renderUserFooter(state.currentUser);

            // 3. Fetch and render all data
            await fetchAndRenderAll();

            // Sonra tüm sohbet kanallarına abone ol
            const conversationIds = await supabaseService.getUserConversationIds(state.currentUser.id);
            if (conversationIds.length > 0) {
                subscribeToAllConversations(conversationIds);
            }

            // 4. Set up event listeners
            if (ui.tabsContainer) {
                ui.tabsContainer.addEventListener('click', handleTabClick);
            }
            if (ui.friendsContentContainer) {
                // This now handles both friend card clicks and pending request actions
                ui.friendsContentContainer.addEventListener('click', handlePendingRequestAction);
            }
            if (ui.dmList) {
                ui.dmList.addEventListener('click', handleDmItemClick);
            }
            if (ui.addFriendModal.button) {
                ui.addFriendModal.button.addEventListener('click', () => loadComponent('add-friend'));
            }

            // Grup sohbeti butonuna event listener ekle
            const groupChatBtn = document.querySelector('.chat-type-btn:not(.active)');
            if (groupChatBtn) {
                groupChatBtn.addEventListener('click', handleGroupChatClick);
            }

            // Profil butonuna event listener ekle
            const profileBtn = document.querySelector('.profile-btn');
            if (profileBtn) {
                profileBtn.addEventListener('click', handleProfileButtonClick);
            }

            // Sidebar butonları için event listener'ları doğrudan ekleyelim
            const serverManagementBtn = document.querySelector('.sidebar-item.add-server');
            if (serverManagementBtn) {
                serverManagementBtn.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Önce tıklama efekti uygulayalım
                    const icon = serverManagementBtn.querySelector('.sidebar-item-icon');
                    icon.style.transform = 'rotate(90deg)';
                    serverManagementBtn.classList.add('clicked');

                    setTimeout(() => {
                        icon.style.transform = '';
                        serverManagementBtn.classList.remove('clicked');

                        // Sunucu işlemleri panelini aç
                        console.log('Sunucu İşlemleri paneli açılıyor');
                        loadComponent('join-server');
                    }, 300);
                });
            }

            const shopBtn = document.querySelector('.sidebar-item.shop');
            if (shopBtn) {
                shopBtn.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Önce tıklama efekti uygulayalım
                    const icon = shopBtn.querySelector('.sidebar-item-icon');
                    icon.style.transform = 'scale(1.2)';
                    shopBtn.classList.add('clicked');

                    setTimeout(() => {
                        icon.style.transform = '';
                        shopBtn.classList.remove('clicked');

                        // Sonra işlevi gerçekleştirelim
                        console.log('Mağaza butonuna tıklandı');
                        window.location.href = '/shop.html';
                    }, 300);
                });
            }

            const settingsBtn = document.querySelector('.sidebar-item.settings');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', (e) => {
                    e.preventDefault();

                    // Önce tıklama efekti uygulayalım
                    const icon = settingsBtn.querySelector('.sidebar-item-icon');
                    icon.style.transform = 'rotate(180deg)';
                    settingsBtn.classList.add('clicked');

                    setTimeout(() => {
                        icon.style.transform = '';
                        settingsBtn.classList.remove('clicked');

                        // Sonra işlevi gerçekleştirelim
                        console.log('Ayarlar butonuna tıklandı');
                        window.location.href = '/settings.html';
                    }, 300);
                });
            }

            // Yeni eklenen footer butonları için listener'lar ekleyelim
            const logoutBtn = document.querySelector('.dm-user-control.logout-button');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    console.log('Çıkış yapılıyor...');
                    await supabase.auth.signOut();
                    window.location.href = '/login.html';
                });
            }

            if (ui.sidebarToggleButton) {
                ui.sidebarToggleButton.addEventListener('click', () => {
                    document.body.classList.toggle('sidebar-closed');
                    ui.serverSidebar.classList.toggle('sidebar-collapsed');
                });
            }
            if (ui.chatSendBtn) {
                ui.chatSendBtn.addEventListener('click', handleSendMessage);
            }
            if (ui.chatInput) {
                ui.chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault(); // Prevent new line
                        handleSendMessage();
                    }
                });
            }
            if (ui.chatCloseBtn) {
                ui.chatCloseBtn.addEventListener('click', renderer.hideChatPanel);
            }

            // 5. Setup Real-time Subscriptions
            // Not: Her kanal için doğru formatı ve bağlantı mantığını kullan

            // Kullanıcı varlık durumu (presence) kanalı - güvenilir çevrimiçi takibi için optimize edildi
            const presenceChannel = supabase.channel('online_users');

            // Kanalı state'e kaydet ki diğer fonksiyonlar da erişebilsin
            state.presenceChannel = presenceChannel;

            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    const newState = presenceChannel.presenceState();
                    console.log('[Presence] Received updated presence state:', newState);

                    // Çevrimiçi kullanıcıların ID'lerini Set olarak sakla
                    const onlineUserIds = new Set();

                    // Her bir kullanıcıyı döngüye al
                    Object.keys(newState).forEach(userId => {
                        try {
                            // Her bir presence kaydındaki kullanıcı verilerini al
                            const presenceData = newState[userId][0]; // İlk kaydı kullan

                            if (presenceData && presenceData.user_id) {
                                // UUID formatındaki kullanıcı ID'sini ekle
                                onlineUserIds.add(presenceData.user_id);
                            } else {
                                // Eski yöntem: Kullanıcı ID'sini temizle
                                const cleanUserId = userId.replace(/^online_users:/, '');
                                onlineUserIds.add(cleanUserId);
                            }
                        } catch (error) {
                            console.error('[Presence] Error parsing presence data:', error);
                        }
                    });

                    // Mevcut kullanıcıyı her zaman çevrimiçi olarak işaretle
                    if (state.currentUser && state.currentUser.id) {
                        onlineUserIds.add(state.currentUser.id);
                    }

                    // State'i güncelle
                    state.onlineFriends = onlineUserIds;

                    console.log('[Presence] Online friends updated:', Array.from(onlineUserIds));

                    // UI'ı güncelle - tüm çevrimiçi göstergeleri güncelle
                    renderer.render();
                    renderer.renderDirectMessagesList();

                    // Eğer profil modalı açıksa ve görüntülenen kullanıcı çevrimiçi/çevrimdışı olduysa, onu da güncelle
                    if (state.currentFriend) {
                        updateFriendOnlineStatus(state.currentFriend.id);
                    }

                    // Eğer bir sohbet açıksa, sohbetin başlığında görünen durumu güncelle
                    updateChatHeaderStatus();
                })
                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                    console.log('[Presence] User joined:', newPresences);
                    // Burada isteğe bağlı olarak bildirim gösterebilirsiniz
                })
                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                    console.log('[Presence] User left:', leftPresences);
                    // Burada isteğe bağlı olarak bildirim gösterebilirsiniz
                })
                .subscribe(async (status) => {
                    console.log(`[Presence] Subscription status: ${status}`);
                    if (status === 'SUBSCRIBED') {
                        try {
                            // Kullanıcı bilgilerini track et
                            await trackPresence();

                            // Düzenli heartbeat göndermeyi başlat
                            startPresenceHeartbeat();

                            console.log('[Presence] Successfully tracked user presence');
                        } catch (error) {
                            console.error('[Presence] Error tracking presence:', error);
                        }
                    }
                });

            // Arkadaşlık değişikliklerini dinleyen kanal
            const friendshipsChannel = supabase.channel('friendships_changes');

            friendshipsChannel
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'friendships',
                        filter: `user_id_1=eq.${state.currentUser.id}`
                    },
                    payload => {
                        console.log('[Friendships] Change detected in user_id_1 friendships:', payload);
                        fetchAndRenderAll();
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'friendships',
                        filter: `user_id_2=eq.${state.currentUser.id}`
                    },
                    payload => {
                        console.log('[Friendships] Change detected in user_id_2 friendships:', payload);
                        fetchAndRenderAll();
                    }
                )
                .subscribe((status) => {
                    console.log(`[Friendships] Subscription status: ${status}`);
                });

            // Emoji ve GIF butonlarına event listener ekle
            const emojiBtn = document.querySelector('.emoji-btn');
            if (emojiBtn) {
                emojiBtn.addEventListener('click', handleEmojiButtonClick);
            }

            const gifBtn = document.querySelector('.gif-btn');
            if (gifBtn) {
                gifBtn.addEventListener('click', handleGifButtonClick);
            }

            // Panel dışına tıklanınca kapatma için document'a event listener ekle
            document.addEventListener('click', handleClickOutsidePanels);

            // Yeni eklenen dosya yükleme butonu için listener
            const fileUploadBtn = document.querySelector('.file-upload-btn');
            if (fileUploadBtn) {
                fileUploadBtn.addEventListener('click', handleFileUploadButtonClick);
            }

            // Dosya input değişimini dinle
            const fileInput = document.getElementById('image-upload');
            if (fileInput) {
                fileInput.addEventListener('change', handleFileSelected);
            }

        } catch (error) {
            console.error('Fatal initialization error:', error);
            // Optionally, show a user-friendly error message on the screen
        }
    };

    // This function needs to be created to handle clicks on friend cards
    function handleFriendCardAction(e) {
        const target = e.target;
        const actionTarget = target.closest('[data-action]');

        if (!actionTarget) return;

        const action = actionTarget.dataset.action;
        const card = target.closest('.friend-card');

        if (!card) return;

        const friendId = card.dataset.userId;
        const friend = state.friends.find(f => f.id === friendId);

        if (!friend) return;

        switch (action) {
            case 'message':
                supabaseService.getOrCreateConversation(state.currentUser.id, friendId)
                    .then(conversationId => {
                        if (conversationId) {
                            renderer.showChatPanel(friend, conversationId);
                        }
                    });
                break;
            case 'profile':
                showProfileModal(friend);
                break;
            case 'call':
                alert('Sesli arama özelliği yakında eklenecek!');
                break;
        }
    }

    // Profil modal'ını gösterir
    async function showProfileModal(user) {
        try {
            // Profil modal bileşenini yükle ve hazır olmasını bekle
            await loadComponent('profile-modal');

            // Kullanıcının çevrimiçi durumunu kontrol et
            user.is_online = state.onlineFriends.has(user.id);

            // Fonksiyonun hazır olduğu garanti edildi, doğrudan çağır
            window.initializeProfileModal(user, state.currentUser, supabase, (result) => {
                if (result && result.action === 'message') {
                    supabaseService.getOrCreateConversation(state.currentUser.id, result.userId)
                        .then(conversationId => {
                            if (conversationId) {
                                const friend = state.friends.find(f => f.id === result.userId);
                                if (friend) renderer.showChatPanel(friend, conversationId);
                            }
                        });
                } else if (result && result.action === 'removed') {
                    fetchAndRenderAll();
                }
            });
        } catch (error) {
            console.error('Profil modalı yüklenirken bir hata oluştu:', error);
        }
    }

    // --- DYNAMIC COMPONENT LOADER ---
    // Basit bellek içi cache ile HTML şablonunu ve JS durumunu önbelleğe alıyoruz
    const componentHtmlCache = new Map();
    const componentJsCache = new Map(); // JS yükleme durumlarını takip etmek için yeni cache

    /**
     * Loads an HTML component into the DOM and initializes its specific JS.
     * @param {string} componentName - The name of the component (e.g., 'add-friend').
     */
    async function loadComponent(componentName) {
        try {
            const componentPaths = {
                'add-friend': {
                    html: 'components/add-friend/add-friend.html',
                    css: 'components/add-friend/add-friend.css',
                    js: 'components/add-friend/add-friend.js',
                    initFunction: 'initializeAddFriendPanel'
                },
                'join-server': {
                    html: 'components/join-server/join-server.html',
                    css: 'components/join-server/join-server.css',
                    js: 'components/join-server/join-server.js',
                    initFunction: 'initializeJoinServerPanel'
                },
                'profile-modal': {
                    html: 'components/profile-modal/profile-modal.html',
                    css: 'components/profile-modal/profile-modal.css',
                    js: 'components/profile-modal/profile-modal.js',
                    initFunction: 'initializeProfileModal'
                }
            };

            const component = componentPaths[componentName];
            if (!component) throw new Error(`Bileşen bulunamadı: ${componentName}`);

            // Paralel yükleme için tüm işlemleri aynı anda başlatalım
            const loadTasks = [];

            // 1. HTML içeriğini yükle (önbellekten veya uzaktan)
            const htmlPromise = new Promise(async (resolve) => {
                if (componentHtmlCache.has(component.html)) {
                    resolve(componentHtmlCache.get(component.html));
                } else {
                    try {
                        const htmlResponse = await fetch(component.html);
                        if (!htmlResponse.ok) throw new Error(`HTML yüklenemedi: ${component.html}`);
                        const htmlContent = await htmlResponse.text();
                        componentHtmlCache.set(component.html, htmlContent);
                        resolve(htmlContent);
                    } catch (error) {
                        console.error(`HTML yükleme hatası: ${error.message}`);
                        resolve(''); // Hata durumunda boş içerik döndür ama işlemi durdurma
                    }
                }
            });
            loadTasks.push(htmlPromise);

            // 2. CSS yükle (eğer yoksa)
            if (component.css && !document.head.querySelector(`link[href="${component.css}"]`)) {
                const cssPromise = new Promise((resolve) => {
                    const cssLink = document.createElement('link');
                    cssLink.rel = 'stylesheet';
                    cssLink.href = component.css;
                    cssLink.onload = () => resolve();
                    cssLink.onerror = () => {
                        console.error(`CSS yüklenemedi: ${component.css}`);
                        resolve(); // Hata durumunda bile devam et
                    };
                    document.head.appendChild(cssLink);
                });
                loadTasks.push(cssPromise);
            }

            // 3. JavaScript'i yükle ve hazır olmasını bekle
            if (component.js && component.initFunction) {
                // Daha önce bu JS için yükleme başlatılmış mı kontrol et
                let jsPromise;
                if (componentJsCache.has(component.js)) {
                    jsPromise = componentJsCache.get(component.js);
                } else {
                    jsPromise = new Promise((resolve) => {
                        if (typeof window[component.initFunction] === 'function') {
                            // Fonksiyon zaten hazır
                            resolve();
                            return;
                        }

                        // Eğer script zaten yüklenmekteyse, hazır olmasını bekle
                        const existingJs = document.head.querySelector(`script[src="${component.js}"]`);
                        if (existingJs) {
                            // Script yükleniyor, hazır olmasını bekle
                            const checkFunction = () => {
                                if (typeof window[component.initFunction] === 'function') {
                                    resolve();
                                } else {
                                    // Hızlı polling yerine, tarayıcının bir sonraki boşta kalma zamanını kullan
                                    requestAnimationFrame(checkFunction);
                                }
                            };
                            requestAnimationFrame(checkFunction);
                        } else {
                            // Script henüz yüklenmemiş, yüklemeyi başlat
                            const jsScript = document.createElement('script');
                            jsScript.src = component.js;
                            jsScript.onload = () => {
                                // Script yüklendi, fonksiyonun hazır olmasını bekle
                                const checkFunction = () => {
                                    if (typeof window[component.initFunction] === 'function') {
                                        resolve();
                                    } else {
                                        requestAnimationFrame(checkFunction);
                                    }
                                };
                                requestAnimationFrame(checkFunction);
                            };
                            jsScript.onerror = () => {
                                console.error(`JS yüklenemedi: ${component.js}`);
                                resolve(); // Hata durumunda bile devam et
                            };
                            document.head.appendChild(jsScript);
                        }
                    });

                    // Promise'i önbelleğe al, aynı anda birden fazla istek gelirse yeniden yüklemeyi önle
                    componentJsCache.set(component.js, jsPromise);
                }

                loadTasks.push(jsPromise);
            }

            // Tüm yükleme görevlerini paralel olarak bekle
            const [htmlContent] = await Promise.all(loadTasks);

            // HTML içeriğini DOM'a ekle
            let container = document.getElementById(`${componentName}-modal-container`);
            if (!container) {
                container = document.createElement('div');
                container.id = `${componentName}-modal-container`;
                document.body.appendChild(container);
            }
            container.innerHTML = htmlContent;

            // Otomatik başlatma, yalnızca profile-modal dışındaki bileşenler için
            if (component.initFunction && componentName !== 'profile-modal') {
                if (window[component.initFunction]) {
                    window[component.initFunction](supabase, () => {
                        console.log(`${componentName} bileşeni kapatıldı`);
                        // fetchAndRenderAll();
                    });
                } else {
                    console.error(`Initialize fonksiyonu bulunamadı: ${component.initFunction}`);
                }
            }
        } catch (error) {
            console.error(`${componentName} bileşeni yüklenirken hata oluştu:`, error);
        }
    }

    async function handleSendMessage() {
        if (!ui.chatInput || !state.currentConversationId) return;

        const content = ui.chatInput.value.trim();
        if (!content) return;

        const tempId = `temp-${Date.now()}`;
        ui.chatInput.value = '';
        ui.chatInput.focus();

        const tempMessage = {
            id: tempId,
            conversation_id: state.currentConversationId,
            sender_id: state.currentUser.id,
            content: content,
            createdAt: new Date().toISOString(),
            sender: state.currentUser // Optimistik UI için kendi profilimizi kullan
        };

        state.messages.push(tempMessage);
        renderer.renderMessages(state.messages);

        const { data: serverMessage, error } = await supabaseService.sendMessage(
            state.currentConversationId,
            state.currentUser.id,
            content
        );

        const messageIndex = state.messages.findIndex(m => m.id === tempId);

        if (error) {
            console.error('[SEND] Failed to send message:', error);
            if (messageIndex !== -1) {
                state.messages.splice(messageIndex, 1); // Başarısız olursa geçici mesajı sil
                renderer.renderMessages(state.messages);
            }
            alert("Mesaj gönderilemedi. Lütfen tekrar deneyin.");
        } else {
            console.log('[SEND] Message sent successfully, replacing temp message.');
            if (messageIndex !== -1) {
                state.messages[messageIndex] = serverMessage; // Geçici mesajı gerçek olanla değiştir
                // Tekrar render etmeye gerek yok, çünkü zaman vs. aynı olmalı
                // Sadece data-message-id'yi güncellemek yeterli
                const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
                if (tempElement) {
                    tempElement.dataset.messageId = serverMessage.id;
                }
            }
        }
    }

    // Grup Sohbeti butonuna tıklandığında
    function handleGroupChatClick(e) {
        alert("Grup sohbeti özelliği yakında eklenecek!");
    }

    // Profil butonuna tıklandığında
    function handleProfileButtonClick() {
        if (!state.currentFriend) return;

        // Profil modalını aç
        showProfileModal(state.currentFriend);
    }

    // Emoji butonuna tıklandığında
    function handleEmojiButtonClick() {
        const emojiPanel = document.querySelector('.emoji-panel');
        const gifPanel = document.querySelector('.gif-panel');

        // GIF panelini kapat
        gifPanel.classList.remove('active');
        document.querySelector('.gif-btn').classList.remove('active');

        // Emoji panelini aç/kapat
        emojiPanel.classList.toggle('active');
        document.querySelector('.emoji-btn').classList.toggle('active');
    }

    // GIF butonuna tıklandığında
    function handleGifButtonClick() {
        const emojiPanel = document.querySelector('.emoji-panel');
        const gifPanel = document.querySelector('.gif-panel');

        // Emoji panelini kapat
        emojiPanel.classList.remove('active');
        document.querySelector('.emoji-btn').classList.remove('active');

        // GIF panelini aç/kapat
        gifPanel.classList.toggle('active');
        document.querySelector('.gif-btn').classList.toggle('active');
    }

    // Panellerin dışına tıklanınca kapatma
    function handleClickOutsidePanels(e) {
        const emojiPanel = document.querySelector('.emoji-panel');
        const gifPanel = document.querySelector('.gif-panel');
        const emojiBtn = document.querySelector('.emoji-btn');
        const gifBtn = document.querySelector('.gif-btn');

        // Eğer emoji paneli açıksa ve emoji butonu veya panel dışına tıklandıysa
        if (emojiPanel.classList.contains('active') &&
            !emojiPanel.contains(e.target) &&
            !emojiBtn.contains(e.target)) {
            emojiPanel.classList.remove('active');
            emojiBtn.classList.remove('active');
        }

        // Eğer GIF paneli açıksa ve GIF butonu veya panel dışına tıklandıysa
        if (gifPanel.classList.contains('active') &&
            !gifPanel.contains(e.target) &&
            !gifBtn.contains(e.target)) {
            gifPanel.classList.remove('active');
            gifBtn.classList.remove('active');
        }
    }

    /**
     * Kullanıcının çevrimiçi durumunu Supabase'e düzenli olarak bildirmek için
     * düzenli aralıklarla çalışan heartbeat fonksiyonu
     */
    function startPresenceHeartbeat() {
        // Kullanıcı aktivitesini izlemek için değişkenler
        let lastActivityTime = Date.now();
        const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 dakika inaktivite süresi
        let isOfflineDueToInactivity = false;

        // Kullanıcı aktivitesini güncelleyen fonksiyon
        const updateActivity = () => {
            lastActivityTime = Date.now();

            // Eğer inaktiviteden dolayı çevrimdışıysa, yeniden çevrimiçi yap
            if (isOfflineDueToInactivity) {
                trackPresence();
                isOfflineDueToInactivity = false;
                console.log('[Presence] User is active again, tracking presence');
            }
        };

        // Aktivite olaylarını dinle
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(eventName => {
            document.addEventListener(eventName, updateActivity, { passive: true });
        });

        // Tarayıcı kapatıldığında çevrimdışı olarak işaretle
        window.addEventListener('beforeunload', async () => {
            if (state.presenceChannel) {
                try {
                    await state.presenceChannel.untrack();
                    console.log('[Presence] Successfully untracked before page unload');
                    // LocalStorage'da çevrimdışı olma zamanını kaydet
                    localStorage.setItem('chatlify_offline_time', Date.now().toString());
                } catch (e) {
                    console.error('[Presence] Error untracking presence:', e);
                }
            }
        });

        // Düzenli olarak varlık bilgisini güncelle ve inaktiviteyi kontrol et (60 saniyede bir)
        setInterval(async () => {
            // Kullanıcı oturumu aktif mi kontrol et
            if (state.currentUser && state.presenceChannel) {
                const now = Date.now();

                // İnaktivite kontrolü - 30 dakikadan fazla aktif değilse
                if ((now - lastActivityTime) > INACTIVITY_TIMEOUT) {
                    if (!isOfflineDueToInactivity) {
                        console.log('[Presence] User inactive for too long, marking as offline');
                        try {
                            await state.presenceChannel.untrack();
                            isOfflineDueToInactivity = true;
                        } catch (e) {
                            console.error('[Presence] Error untracking due to inactivity:', e);
                        }
                    }
                } else {
                    // Aktifse presence gönder
                    await trackPresence();
                }
            }
        }, 60000); // 60 saniye

        // Sayfa yüklendiğinde, kullanıcının son çevrimdışı olma zamanını kontrol et
        const lastOfflineTime = parseInt(localStorage.getItem('chatlify_offline_time') || '0');
        const now = Date.now();
        const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 dakika

        // Eğer 5 dakikadan daha kısa süre önce çevrimdışı olduysa, hemen çevrimiçi yap
        if (lastOfflineTime > 0 && (now - lastOfflineTime) < OFFLINE_THRESHOLD) {
            console.log('[Presence] Recently offline, immediately tracking presence');
            trackPresence();
        }

        // Önceki implementasyonda kullanılan sayfa görünürlüğünü değiştirme kısmını kaldırdık
        // Artık kullanıcı sekmeyi değiştirdiğinde çevrimdışı olmayacak
    }

    /**
     * Kullanıcının çevrimiçi durumunu Supabase'e bildirir
     */
    async function trackPresence() {
        if (!state.currentUser || !state.presenceChannel) return;

        try {
            // İstemci bilgilerini ve kullanıcı verisini track et
            const presenceData = {
                user_id: state.currentUser.id,
                username: state.currentUser.username,
                avatar_url: state.currentUser.avatar_url,
                online_at: new Date().toISOString(),
                client_reference_id: generateClientId(),
                last_active: Date.now()
            };

            console.log('[Presence] Tracking presence with data:', presenceData);

            await state.presenceChannel.track(presenceData);

            // Kendimizi onlineFriends'e ekleyelim
            state.onlineFriends.add(state.currentUser.id);

            state.lastHeartbeat = Date.now();
            console.log('[Presence] Heartbeat sent at:', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('[Presence] Failed to send presence heartbeat:', error);
        }
    }

    /**
     * Her istemci için benzersiz bir ID oluşturur
     * Bu, aynı kullanıcının birden fazla cihazda oturum açmasını destekler
     */
    function generateClientId() {
        // LocalStorage'da kayıtlı bir ID var mı kontrol et
        let clientId = localStorage.getItem('chatlify_client_id');

        // Yoksa yeni bir ID oluştur ve kaydet
        if (!clientId) {
            clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            localStorage.setItem('chatlify_client_id', clientId);
        }

        return clientId;
    }

    /**
     * Açık olan sohbet başlığındaki çevrimiçi durumunu günceller
     */
    function updateChatHeaderStatus() {
        if (!state.currentFriend) return;

        const chatHeaderUser = ui.chatHeaderUser;
        if (!chatHeaderUser) return;

        const statusEl = chatHeaderUser.querySelector('.chat-status');
        if (!statusEl) return;

        const isOnline = state.onlineFriends.has(state.currentFriend.id);
        statusEl.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
        statusEl.className = `chat-status ${isOnline ? 'online' : 'offline'}`;
    }

    /**
     * Bir kullanıcının çevrimiçi durumunu profil modalı için günceller
     */
    function updateFriendOnlineStatus(userId) {
        // Profil modalı açık mı kontrol et
        const modal = document.getElementById('profile-modal');
        if (!modal || !modal.classList.contains('active')) return;

        // Eğer gösterilen profil mevcut kullanıcıya aitse, her zaman çevrimiçi göster
        const isCurrentUser = state.currentUser && userId === state.currentUser.id;

        // Diğer kullanıcılar için çevrimiçi setinden kontrol et
        const isOnline = isCurrentUser || state.onlineFriends.has(userId);

        // Status elementlerini bul
        const statusText = modal.querySelector('.status-text');
        const statusIndicator = modal.querySelector('.status-indicator');
        const statusDot = modal.querySelector('.status-dot');
        const profileStatus = modal.querySelector('.profile-status');

        if (statusText) statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';

        if (statusIndicator) {
            if (isOnline) {
                statusIndicator.classList.add('online');
                statusIndicator.classList.remove('offline');
            } else {
                statusIndicator.classList.remove('online');
                statusIndicator.classList.add('offline');
            }
        }

        if (statusDot) {
            if (isOnline) {
                statusDot.classList.add('online');
            } else {
                statusDot.classList.remove('online');
            }
        }

        if (profileStatus) {
            if (isOnline) {
                profileStatus.classList.add('online');
                profileStatus.classList.remove('offline');
            } else {
                profileStatus.classList.remove('online');
                profileStatus.classList.add('offline');
            }
        }
    }

    // Dosya ekleme butonuna tıklandığında
    function handleFileUploadButtonClick() {
        // Zaten yükleme yapılıyorsa işlemi engelle
        if (state.isUploadingImage) {
            alert("Şu anda bir görsel yükleniyor. Lütfen bekleyin.");
            return;
        }

        const fileInput = document.getElementById('image-upload');
        if (fileInput) {
            fileInput.click();
        }
    }

    // Dosya seçildiğinde
    function handleFileSelected(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Dosya bir görsel mi kontrol et
        if (!file.type.match('image.*')) {
            alert("Lütfen sadece görsel dosyası (PNG, JPG, JPEG, GIF) yükleyin.");
            e.target.value = '';
            return;
        }

        // Dosya boyutu kontrolü
        if (file.size > MAX_IMAGE_SIZE) {
            alert("Dosya boyutu 2MB'dan büyük olamaz. Lütfen daha küçük bir görsel seçin.");
            e.target.value = '';
            return;
        }

        // Yükleme durumunu güncelle
        state.isUploadingImage = true;

        // Kullanıcıya yükleme işleminin başladığını göster
        showUploadingIndicator();

        // Cloudinary'ye yükle
        uploadImageToCloudinary(file);

        // Input'u temizle
        e.target.value = '';
    }

    // Yükleme göstergesini ekle
    function showUploadingIndicator() {
        if (!ui.chatMessages) return;

        // Temp mesaj oluştur
        const uploadingElement = document.createElement('div');
        uploadingElement.className = 'message-group own-message uploading-message';
        uploadingElement.innerHTML = `
            <div class="message-group-content">
                <div class="message-content">
                    <p><i class="fas fa-spinner fa-spin"></i> Görsel yükleniyor...</p>
                </div>
            </div>
        `;

        ui.chatMessages.appendChild(uploadingElement);
        renderer.scrollToBottom();

        // Referansı sakla
        state.uploadingImageElement = uploadingElement;
    }

    // Yükleme göstergesini kaldır
    function removeUploadingIndicator() {
        if (state.uploadingImageElement && state.uploadingImageElement.parentNode) {
            state.uploadingImageElement.parentNode.removeChild(state.uploadingImageElement);
            state.uploadingImageElement = null;
        }
    }

    // Cloudinary'ye görsel yükleme
    function uploadImageToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        console.log(`[UPLOAD] Cloudinary request to: https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);
        console.log(`[UPLOAD] Using upload_preset: ${CLOUDINARY_UPLOAD_PRESET}`);

        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    // HTTP hata kodunu yakala
                    console.error(`[UPLOAD] HTTP error: ${response.status} ${response.statusText}`);
                    throw new Error(`HTTP error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // API hatası kontrolü
                if (data.error) {
                    console.error('[UPLOAD] Cloudinary API error:', data.error);
                    throw new Error(data.error.message || 'Cloudinary API hatası');
                }

                console.log('[UPLOAD] Image uploaded successfully:', data);

                // Yükleme durumunu sıfırla
                state.isUploadingImage = false;
                removeUploadingIndicator();

                // Yüklenen görseli mesaj olarak gönder
                if (data.secure_url) {
                    sendImageMessage(data.secure_url, data.original_filename, data.bytes);
                } else {
                    throw new Error('Görsel URL alınamadı');
                }
            })
            .catch(error => {
                console.error('[UPLOAD] Error uploading image:', error);
                alert(`Görsel yüklenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);

                // Yükleme durumunu sıfırla
                state.isUploadingImage = false;
                removeUploadingIndicator();
            });
    }

    // Görsel mesajı gönder
    async function sendImageMessage(imageUrl, fileName, fileSize) {
        if (!state.currentConversationId) return;

        // Dosya boyutunu formatla
        const formattedSize = formatFileSize(fileSize);

        // Görsel mesajı hazırla
        const imageContent = `<div class="message-image-container">
            <img src="${imageUrl}" alt="${fileName}" class="message-image">
            <div class="message-attachment">
                <div class="attachment-icon"><i class="fas fa-file-image"></i></div>
                <div class="attachment-details">
                    <div class="attachment-name">${fileName}</div>
                    <div class="attachment-size">${formattedSize}</div>
                </div>
            </div>
        </div>`;

        // Geçici mesaj ID'si
        const tempId = `temp-img-${Date.now()}`;

        // Geçici mesaj
        const tempMessage = {
            id: tempId,
            conversation_id: state.currentConversationId,
            sender_id: state.currentUser.id,
            content: imageContent,
            createdAt: new Date().toISOString(),
            sender: state.currentUser,
            is_image: true
        };

        // Mesajı UI'a ekle
        state.messages.push(tempMessage);
        renderer.renderMessages(state.messages);

        // Supabase'e gönder
        const { data: serverMessage, error } = await supabaseService.sendMessage(
            state.currentConversationId,
            state.currentUser.id,
            imageContent
        );

        // Sonucu işle
        const messageIndex = state.messages.findIndex(m => m.id === tempId);

        if (error) {
            console.error('[SEND] Failed to send image message:', error);
            if (messageIndex !== -1) {
                state.messages.splice(messageIndex, 1);
                renderer.renderMessages(state.messages);
            }
            alert("Görsel mesajı gönderilemedi. Lütfen tekrar deneyin.");
        } else {
            console.log('[SEND] Image message sent successfully.');
            if (messageIndex !== -1) {
                state.messages[messageIndex] = serverMessage;
                const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
                if (tempElement) {
                    tempElement.dataset.messageId = serverMessage.id;
                }
            }
        }
    }

    // Dosya boyutunu formatlı şekilde göster
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    init();
});