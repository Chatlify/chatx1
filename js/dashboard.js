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
            const { data, error } = await supabase
                .from('friendships')
                .select('user_id_1, user_id_2, profiles_1:user_id_1(id, username, avatar_url), profiles_2:user_id_2(id, username, avatar_url)')
                .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
                .eq('status', 'accepted');

            if (error) {
                console.error('Error fetching friends:', error);
                return [];
            }
            return data.map(f => (f.user_id_1 === userId ? f.profiles_2 : f.profiles_1)).filter(Boolean);
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
            // Önceki aboneliği (varsa) güvenli bir şekilde sonlandır
            if (state.messageSubscription) {
                console.log(`[Sub] Unsubscribing from previous channel: ${state.messageSubscription.topic}`);
                state.messageSubscription.unsubscribe();
                state.messageSubscription = null;
            }

            console.log(`[Sub] Setting up new message subscription for conversation: ${conversationId}`);

            // Kanal adını daha belirgin hale getiriyoruz
            const channel = supabase.channel(`realtime:messages:${conversationId}`);

            channel.on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    // ÇÖZÜM: Sunucuya sadece bu sohbete ait mesajları göndermesini söylüyoruz.
                    // Bu, performansı ciddi şekilde artırır ve TIMED_OUT hatalarını önler.
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    console.log('[Sub] Received payload:', payload);
                    const newMessage = payload.new;

                    // Gelen mesajın bu sohbete ait olduğunu bir kez daha kontrol et (ekstra güvenlik)
                    if (newMessage.conversation_id !== state.currentConversationId) {
                        console.warn(`[Sub] Received a message for a different conversation. Current: ${state.currentConversationId}, Received: ${newMessage.conversation_id}. Skipping.`);
                        return;
                    }

                    // Eğer mesaj zaten ekranda varsa (optimistik render'dan dolayı), tekrar ekleme
                    if (document.querySelector(`[data-message-id="${newMessage.id}"]`)) {
                        console.log(`[Sub] Message with ID ${newMessage.id} already exists. Skipping render.`);
                        return;
                    }

                    // Mesajı render et
                    renderer.renderMessages([...state.messages, newMessage]);
                    state.messages.push(newMessage);
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
                        <div class="card-banner"></div>
                        <div class="card-avatar">
                            <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}'s avatar">
                            <div class="status-dot ${statusClass}" title="${statusText}"></div>
                        </div>
                        <div class="card-username">${friend.username}</div>
                        <div class="card-status">${statusText}</div>
                        <div class="card-actions">
                            <button class="card-action-btn message-btn" title="Mesaj Gönder">
                                <i class="fas fa-comment-dots"></i>
                            </button>
                            <button class="card-action-btn call-btn" title="Sesli Arama">
                                <i class="fas fa-phone-alt"></i>
                            </button>
                            <button class="card-action-btn profile-btn" title="Profil">
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

            userFooterName.textContent = profile.username || 'Kullanıcı';
            userFooterAvatar.src = profile.avatar_url || 'images/defaultavatar.png';
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

            // Mesajları temizle
            ui.chatMessages.innerHTML = '';

            // Mesaj yoksa boş bir durumu göster
            if (!messages || messages.length === 0) {
                console.log('[RENDER] No messages to render');
                return;
            }

            try {
                console.log('[RENDER] Processing', messages.length, 'messages');

                // Her mesaj için bir mesaj elementi oluştur
                messages.forEach(msg => {
                    if (!msg || !msg.sender_id || !msg.content) {
                        console.warn('[RENDER] Invalid message object:', msg);
                        return; // Bu mesajı atla
                    }

                    // Mesaj kendi kullanıcıya mı ait?
                    const isOwnMessage = msg.sender_id === state.currentUser.id;

                    // Mesaj elementini oluştur
                    const messageElement = document.createElement('div');
                    messageElement.className = `message-group ${isOwnMessage ? 'own-message' : ''}`;
                    messageElement.dataset.messageId = msg.id;

                    // Mesaj içeriğini oluştur
                    let messageHTML = '';

                    // Kendi mesajımız değilse avatar göster
                    if (!isOwnMessage) {
                        const avatarUrl = msg.sender?.avatar_url || 'images/defaultavatar.png';
                        messageHTML += `
                            <div class="message-group-avatar">
                                <img src="${avatarUrl}" alt="${msg.sender?.username || 'Kullanıcı'}">
                            </div>
                        `;
                    }

                    // Mesaj içeriği ve başlık
                    const author = isOwnMessage ? 'Sen' : (msg.sender?.username || 'Kullanıcı');

                    // Zaman formatı
                    let time;
                    try {
                        time = new Date(msg.createdAt).toLocaleTimeString('tr-TR', {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } catch (e) {
                        console.warn('[RENDER] Error formatting time:', e);
                        time = '00:00';
                    }

                    // Mesaj içeriği kısmını ekle
                    messageHTML += `
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

                    // HTML'i mesaj elementine ekle
                    messageElement.innerHTML = messageHTML;

                    // Mesaj elementini DOM'a ekle
                    ui.chatMessages.appendChild(messageElement);

                    console.log('[RENDER] Added message:', msg.id);
                });

                console.log('[RENDER] All messages rendered successfully');

                // Sayfayı en alta kaydır - gecikme ekleyerek DOM güncellemesinin tamamlanmasını bekle
                setTimeout(() => {
                    ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
                    console.log('[RENDER] Scrolled to bottom');
                }, 100);

            } catch (error) {
                console.error('[RENDER] Error rendering messages:', error);
            }
        },

        showChatPanel(friend, conversationId) {
            console.log(`[CHAT] Showing chat panel for friend: ${friend.username}, conversation: ${conversationId}`);

            // UI elementlerini kontrol et
            const { chatPanel, chatHeaderUser, chatMessages, dashboardContainer, chatInput } = ui;

            if (!dashboardContainer || !chatPanel) {
                console.error("[CHAT] Critical UI element not found! Cannot display chat panel.");
                return;
            }

            // Önceki abonelikten çık
            if (state.messageSubscription) {
                state.messageSubscription();
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
            if (chatMessages) {
                chatMessages.innerHTML = `
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
            if (chatInput) {
                setTimeout(() => {
                    chatInput.focus();
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
            const { dashboardContainer } = ui;
            if (dashboardContainer) {
                dashboardContainer.classList.remove('chat-active');
            }
            state.currentConversationId = null;

            // Unsubscribe from the message channel
            if (state.messageSubscription) {
                state.messageSubscription();
                state.messageSubscription = null;
            }
        }
    };

    // --- 5. EVENT HANDLERS ---
    const handleTabClick = (e) => {
        const tab = e.target.closest('.tab');
        if (!tab || tab.classList.contains('active')) return;

        state.activeFriendsTab = tab.dataset.tab;
        renderer.render();
    };

    async function handleDmItemClick(e) {
        const dmItem = e.target.closest('.dm-item');
        if (!dmItem) return;

        const targetUserId = dmItem.dataset.userId;
        if (!targetUserId || targetUserId === state.currentUser.id) return;

        const friend = state.friends.find(f => f.id === targetUserId);
        if (!friend) return;

        const conversationId = await supabaseService.getOrCreateConversation(state.currentUser.id, targetUserId);

        if (conversationId) {
            renderer.showChatPanel(friend, conversationId);
        } else {
            alert('Sohbet başlatılırken bir hata oluştu.');
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
        if (!state.currentUser) return;

        const [friends, pendingRequests] = await Promise.all([
            supabaseService.getFriends(state.currentUser.id),
            supabaseService.getPendingRequests(state.currentUser.id)
        ]);

        state.friends = friends;
        state.pendingRequests = pendingRequests;

        renderer.render(); // Call the main render function
        renderer.renderDirectMessagesList(); // Render the DMs list in the left sidebar
    }

    const init = async () => {
        try {
            // 1. Get User Session First
            state.currentUser = await supabaseService.getUserSession();
            if (!state.currentUser) {
                console.log("No active session. Redirecting to login.");
                return; // Stop execution if no user
            }

            // 2. Fetch and render basic user info
            const userProfile = await supabaseService.getUserProfile(state.currentUser.id);
            renderer.renderUserFooter(userProfile);

            // 3. Fetch and render all other data (friends, DMs, etc.)
            await fetchAndRenderAll();

            // 4. Setup all event listeners now that the UI is populated
            if (ui.tabsContainer) {
                ui.tabsContainer.addEventListener('click', handleTabClick);
            }
            if (ui.friendsContentContainer) {
                // This now handles both friend card clicks and pending request actions
                ui.friendsContentContainer.addEventListener('click', (e) => {
                    handlePendingRequestAction(e);
                    handleFriendCardAction(e); // You need to create this function
                });
            }
            if (ui.dmList) {
                ui.dmList.addEventListener('click', handleDmItemClick);
            }
            if (ui.addFriendModal.button) {
                ui.addFriendModal.button.addEventListener('click', () => loadComponent('add-friend'));
            }
            if (ui.settingsButton) {
                ui.settingsButton.addEventListener('click', () => { window.location.href = '/settings.html'; });
            }
            if (ui.shopButton) {
                ui.shopButton.addEventListener('click', () => { window.location.href = '/shop.html'; });
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
            // Note: I'm simplifying the channel setup for clarity.
            // You should have one channel for presence and another for DB changes.
            const presenceChannel = supabase.channel('online-users');
            presenceChannel.on('presence', { event: 'sync' }, () => {
                const newState = presenceChannel.presenceState();
                state.onlineFriends = new Set(Object.keys(newState));
                renderer.render();
                renderer.renderDirectMessagesList();
            }).subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await presenceChannel.track({ user_id: state.currentUser.id, online_at: new Date().toISOString() });
                }
            });

            supabase.channel('public:friendships')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
                    console.log('Friendship change detected, refetching data.', payload);
                    fetchAndRenderAll();
                }).subscribe();

        } catch (error) {
            console.error('Fatal initialization error:', error);
            // Optionally, show a user-friendly error message on the screen
        }
    };

    // This function needs to be created to handle clicks on friend cards
    function handleFriendCardAction(e) {
        const messageBtn = e.target.closest('.card-action-btn[title="Mesaj Gönder"]');
        const callBtn = e.target.closest('.card-action-btn[title="Sesli Arama"]');
        const profileBtn = e.target.closest('.card-action-btn[title="Profil"]');

        if (!messageBtn && !callBtn && !profileBtn) return;

        const card = e.target.closest('.friend-card');
        if (!card) return;

        const userId = card.dataset.userId;
        const friend = state.friends.find(f => f.id === userId);
        if (!friend) return;

        if (messageBtn) {
            // Mesaj gönderme işlevi
            supabaseService.getOrCreateConversation(state.currentUser.id, userId)
                .then(conversationId => {
                    if (conversationId) {
                        renderer.showChatPanel(friend, conversationId);
                    }
                });
        }
        else if (profileBtn) {
            // Profil modalını aç
            showProfileModal(friend);
        }
        else if (callBtn) {
            // Sesli arama işlevi (gelecekte eklenebilir)
            alert('Sesli arama özelliği yakında eklenecek!');
        }
    }

    // Profil modal'ını gösterir
    function showProfileModal(user) {
        // UI elementlerini seç
        const modal = document.getElementById('profile-modal-container');
        const closeBtn = modal.querySelector('.profile-modal-close-btn');
        const avatar = modal.querySelector('.profile-modal-avatar img');
        const username = modal.querySelector('.username');
        const statusText = modal.querySelector('.status-text');
        const statusDot = modal.querySelector('.status-dot-modal');
        const bio = modal.querySelector('.bio');
        const memberSince = modal.querySelector('.member-since');
        const messageBtn = modal.querySelector('.btn-primary');

        // Kullanıcı bilgilerini doldur
        avatar.src = user.avatar_url || 'images/defaultavatar.png';
        username.textContent = user.username;

        const isOnline = state.onlineFriends.has(user.id);
        statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';

        // Online/offline durum sınıfını güncelle
        statusDot.className = 'status-dot-modal';
        if (isOnline) statusDot.classList.add('online');
        else statusDot.classList.add('offline');

        // Modalı göster
        modal.classList.add('is-visible');

        // Mesaj gönder butonuna tıklama işlevi ekle
        messageBtn.onclick = () => {
            modal.classList.remove('is-visible');
            supabaseService.getOrCreateConversation(state.currentUser.id, user.id)
                .then(conversationId => {
                    if (conversationId) {
                        renderer.showChatPanel(user, conversationId);
                    }
                });
        };

        // Kapat butonuna tıklama işlevi ekle
        closeBtn.onclick = () => {
            modal.classList.remove('is-visible');
        };

        // Modal dışına tıklandığında modalı kapat
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('is-visible');
            }
        };
    }

    // --- DYNAMIC COMPONENT LOADER ---
    /**
     * Loads an HTML component into the DOM and initializes its specific JS.
     * @param {string} componentName - The name of the component (e.g., 'add-friend').
     */
    async function loadComponent(componentName) {
        const componentPath = `components/${componentName}/${componentName}`; // Corrected path
        try {
            // 1. Fetch HTML
            const response = await fetch(`${componentPath}.html`);
            if (!response.ok) throw new Error(`Component HTML not found at ${componentPath}.html`);
            const html = await response.text();
            document.body.insertAdjacentHTML('beforeend', html);

            // 2. Load CSS
            const cssLink = document.createElement('link');
            cssLink.rel = 'stylesheet';
            cssLink.href = `${componentPath}.css`;
            document.head.appendChild(cssLink);

            // 3. Load and execute JS
            const script = document.createElement('script');
            script.src = `${componentPath}.js`; // Load as a regular script, not a module

            // Use onload to ensure the script is executed before we try to use it
            script.onload = () => {
                if (window.initializeAddFriendPanel) {
                    window.initializeAddFriendPanel(supabase, () => {
                        console.log(`${componentName} panel closed and cleaned up.`);
                        // The component's close function should handle its own removal.
                        // We also clean up the script and CSS to prevent clutter.
                        const panel = document.getElementById('add-friend-panel');
                        if (panel) panel.remove();
                        script.remove();
                        cssLink.remove();
                    });
                } else {
                    console.error(`Initializer for ${componentName} not found.`);
                }
            };
            script.onerror = () => {
                console.error(`Failed to load script: ${componentPath}.js`);
            };
            document.body.appendChild(script);

        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
        }
    }

    async function handleSendMessage() {
        console.log('[SEND] Handling send message action');

        if (!ui.chatInput || !state.currentConversationId) {
            console.error('[SEND] Cannot send message: Missing chat input or conversation ID');
            return;
        }

        const content = ui.chatInput.value.trim();
        if (!content) {
            console.log('[SEND] Empty message, not sending');
            return;
        }

        console.log(`[SEND] Sending message to conversation ${state.currentConversationId}: "${content}"`);

        // Mesaj gönderme öncesi UI'yı temizle
        ui.chatInput.value = '';
        ui.chatInput.focus();

        // Geçici mesaj oluştur (optimistik UI güncellemesi)
        const tempId = `temp-${Date.now()}`;
        const tempMessage = {
            id: tempId,
            conversation_id: state.currentConversationId,
            sender_id: state.currentUser.id,
            content: content,
            contentType: 'text',
            createdAt: new Date().toISOString(),
            sender: {
                username: state.currentUser.username || 'Sen',
                avatar_url: state.currentUser.avatar_url || ui.userFooterAvatar?.src || 'images/defaultavatar.png'
            },
            isTemp: true // Bu geçici bir mesaj olduğunu belirtir
        };

        console.log('[SEND] Created temporary message:', tempMessage);

        // Geçici mesajı ekle ve göster (optimistik UI güncellemesi)
        state.messages.push(tempMessage);
        renderer.renderMessages(state.messages);

        try {
            // Mesajı veritabanına gönder
            const { data, error } = await supabaseService.sendMessage(
                state.currentConversationId,
                state.currentUser.id,
                content
            );

            if (error) {
                console.error('[SEND] Failed to send message:', error);

                // Hata durumunda geçici mesajı kaldır
                state.messages = state.messages.filter(m => m.id !== tempId);
                renderer.renderMessages(state.messages);

                // Kullanıcıya hata mesajı göster
                alert(`Mesaj gönderilemedi: ${error.message || 'Bilinmeyen hata'}`);

                // Mesajı geri koy
                ui.chatInput.value = content;
            } else {
                console.log('[SEND] Message sent successfully, server response:', data);

                // Geçici mesajı gerçek mesajla değiştir
                if (data && data.length > 0) {
                    const realMessage = data[0];

                    // Geçici mesajı gerçek mesajla değiştir
                    const messageIndex = state.messages.findIndex(m => m.id === tempId);
                    if (messageIndex !== -1) {
                        state.messages[messageIndex] = realMessage;
                        console.log('[SEND] Replaced temporary message with real message');
                    } else {
                        // Eğer geçici mesaj bulunamazsa (örneğin başka bir yerde silinmişse), gerçek mesajı ekle
                        state.messages.push(realMessage);
                        console.log('[SEND] Added real message (temp message not found)');
                    }

                    // Mesajları yeniden render et
                    renderer.renderMessages(state.messages);
                }
            }
        } catch (err) {
            console.error('[SEND] Unexpected error sending message:', err);

            // Hata durumunda geçici mesajı kaldır
            state.messages = state.messages.filter(m => m.id !== tempId);
            renderer.renderMessages(state.messages);

            // Kullanıcıya hata mesajı göster
            alert('Mesaj gönderilirken beklenmeyen bir hata oluştu.');

            // Mesajı geri koy
            ui.chatInput.value = content;
        }
    }

    init();
});