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
        settingsButton: document.querySelector('.sidebar-item.settings'),
        shopButton: document.querySelector('.sidebar-item.shop'),
        addServerButton: document.querySelector('.sidebar-item.add-server'),

        // Chat Panel
        chatPanel: document.querySelector('.chat-panel'),
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
    };

    // --- 3. SUPABASE SERVICE ---
    const supabaseService = {
        async getUserSession() {
            const { data, error } = await supabase.auth.getUser();
            if (error || !data.user) {
                console.error('No user session. Redirecting to login.', error);
                window.location.href = 'login.html';
                return null;
            }
            return data.user;
        },
        async getUserProfile(userId) {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (error) console.error(`Error fetching profile for ${userId}:`, error);
            return data;
        },
        async getFriends(userId) {
            console.log("Arkadaşlar getiriliyor, userId:", userId);
            try {
                const { data, error } = await supabase
                    .from('friendships')
                    .select('user_id_1, user_id_2, status, profiles_1:user_id_1(id, username, avatar_url), profiles_2:user_id_2(id, username, avatar_url)')
                    .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
                    .eq('status', 'accepted');

                if (error) {
                    console.error('Error fetching friends:', error);
                    return [];
                }

                console.log("Arkadaş verileri:", data);

                if (!data || data.length === 0) {
                    console.log("Arkadaş bulunamadı");
                    return [];
                }

                // Arkadaş listesini dönüştür
                const friends = data.map(f => {
                    // Eğer user_id_1 bizim ID'miz ise, user_id_2'nin profilini döndür
                    // Değilse, user_id_1'in profilini döndür
                    const friend = f.user_id_1 === userId ? f.profiles_2 : f.profiles_1;
                    if (!friend) {
                        console.error("Arkadaş profili bulunamadı:", f);
                        return null;
                    }
                    return friend;
                }).filter(Boolean); // null değerleri filtrele

                console.log("İşlenmiş arkadaş listesi:", friends);
                return friends;
            } catch (err) {
                console.error("Arkadaşlar getirilirken beklenmeyen hata:", err);
                return [];
            }
        },
        async getPendingRequests(userId) {
            console.log("Bekleyen istekler getiriliyor, userId:", userId);
            try {
                // Kullanıcıya gelen arkadaşlık isteklerini getir
                const { data, error } = await supabase
                    .from('friendships')
                    .select('id, user_id_1, created_at, profiles:user_id_1(id, username, avatar_url)')
                    .eq('user_id_2', userId)
                    .eq('status', 'pending');

                if (error) {
                    console.error('Error fetching pending requests:', error);
                    return [];
                }

                console.log("Bekleyen istek verileri:", data);

                // İstekleri dönüştür
                const requests = data.map(request => ({
                    id: parseInt(request.id),
                    userId: request.user_id_1,
                    username: request.profiles.username,
                    avatarUrl: request.profiles.avatar_url,
                    createdAt: request.created_at
                }));

                console.log("İşlenmiş bekleyen istekler:", requests);
                return requests;
            } catch (err) {
                console.error("Bekleyen istekler getirilirken beklenmeyen hata:", err);
                return [];
            }
        },
        async acceptFriendRequest(requestId) {
            try {
                // Önce isteği getir
                const { data: request, error: fetchError } = await supabase
                    .from('friendships')
                    .select('*')
                    .eq('id', requestId)
                    .single();

                if (fetchError) {
                    console.error('Error fetching friendship request:', fetchError);
                    return { success: false, message: 'Arkadaşlık isteği bulunamadı.' };
                }

                console.log("Arkadaşlık isteği verileri:", request);

                // Şu anki zamanı al
                const currentTime = new Date().toISOString();

                let updateSuccess = false;

                // Yöntem 1: Doğrudan güncelleme
                const { error: updateError } = await supabase
                    .from('friendships')
                    .update({
                        status: 'accepted',
                        updated_at: currentTime
                    })
                    .eq('id', requestId);

                if (!updateError) {
                    updateSuccess = true;
                    console.log("Arkadaşlık isteği başarıyla güncellendi (doğrudan güncelleme)");
                } else {
                    console.error('Error accepting friend request (direct update):', updateError);

                    // Yöntem 2: RPC kullanmayı dene
                    try {
                        const { data: rpcResult, error: rpcError } = await supabase
                            .rpc('accept_friendship_request', {
                                request_id: requestId
                            });

                        if (!rpcError) {
                            updateSuccess = true;
                            console.log("Arkadaşlık isteği başarıyla güncellendi (RPC):", rpcResult);
                        } else {
                            console.error('Error accepting friend request (RPC):', rpcError);
                        }
                    } catch (rpcError) {
                        console.error('Exception in RPC call:', rpcError);
                    }
                }

                // İstek gönderen kullanıcıya bildirim gönder
                await this.broadcastFriendshipUpdate({
                    type: 'friendship_accepted',
                    friendship_id: requestId,
                    user_id_1: request.user_id_1,
                    user_id_2: request.user_id_2,
                    status: 'accepted',
                    updated_at: currentTime
                });

                // Başarılı sonuç döndür
                return {
                    success: true,
                    message: 'Arkadaşlık isteği kabul edildi!',
                    requestData: {
                        ...request,
                        status: 'accepted',
                        updated_at: currentTime
                    }
                };
            } catch (error) {
                console.error('Unexpected error accepting friend request:', error);
                return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
            }
        },

        async broadcastFriendshipUpdate(data) {
            try {
                console.log("Arkadaşlık güncellemesi yayınlanıyor:", data);

                // İstek gönderen kullanıcı için kanal
                const senderChannel = `friendship_updates_${data.user_id_1}`;

                // İstek alan kullanıcı için kanal
                const receiverChannel = `friendship_updates_${data.user_id_2}`;

                // Sender kanalına gönder
                try {
                    const senderResult = await supabase.channel(senderChannel).send({
                        type: 'broadcast',
                        event: 'friendship_update',
                        payload: data
                    });

                    console.log("Gönderen kullanıcı kanalına mesaj gönderildi:", senderResult);
                } catch (senderError) {
                    console.error("Gönderen kanalına mesaj gönderilirken hata:", senderError);
                }

                // Receiver kanalına gönder
                try {
                    const receiverResult = await supabase.channel(receiverChannel).send({
                        type: 'broadcast',
                        event: 'friendship_update',
                        payload: data
                    });

                    console.log("Alan kullanıcı kanalına mesaj gönderildi:", receiverResult);
                } catch (receiverError) {
                    console.error("Alan kanalına mesaj gönderilirken hata:", receiverError);
                }

                // Veritabanı değişikliklerini manuel olarak tetikle
                try {
                    // Arkadaşlık durumunu tekrar güncelle (aynı değerle)
                    // Bu, postgres değişikliklerini tetikleyecektir
                    await supabase
                        .from('friendships')
                        .update({
                            status: data.status,
                            updated_at: data.updated_at
                        })
                        .eq('id', data.friendship_id);

                    console.log("Veritabanı değişikliği tetiklendi");
                } catch (dbError) {
                    console.error("Veritabanı değişikliği tetiklenirken hata:", dbError);
                    // Hatayı yoksay, broadcast işlemi yine de başarılı olabilir
                }

                console.log("Arkadaşlık güncellemesi yayınlandı");
                return true;
            } catch (error) {
                console.error("Arkadaşlık güncellemesi yayınlanırken hata:", error);
                return false;
            }
        },
        async rejectFriendRequest(requestId) {
            try {
                const { error } = await supabase
                    .from('friendships')
                    .delete()
                    .eq('id', requestId);

                if (error) {
                    console.error('Error rejecting friend request:', error);
                    return { success: false, message: 'Arkadaşlık isteği reddedilirken bir hata oluştu.' };
                }

                return { success: true, message: 'Arkadaşlık isteği reddedildi.' };
            } catch (error) {
                console.error('Unexpected error rejecting friend request:', error);
                return { success: false, message: 'Beklenmeyen bir hata oluştu.' };
            }
        },
        async findOrCreateConversation(userId1, userId2) {
            // Logic from old file to find or create a DM
            const { data, error } = await supabase.rpc('get_or_create_conversation', { user_id_1: userId1, user_id_2: userId2 });
            if (error) console.error("Error finding/creating conversation:", error);
            return data;
        },
        async getMessages(conversationId) {
            const { data, error } = await supabase
                .from('messages')
                .select('*, sender:sender_id(*)')
                .eq('conversation_id', conversationId)
                .order('createdAt', { ascending: true });
            if (error) {
                console.error('Error fetching messages:', error);
                throw error;
            }
            return data;
        },
        async sendMessage(conversationId, senderId, content) {
            const { data, error } = await supabase
                .from('messages')
                .insert([{ conversation_id: conversationId, sender_id: senderId, content }])
                .select();
            if (error) {
                console.error('Error sending message:', error);
                throw error;
            }
            return data;
        },
        subscribeToMessages(conversationId, callback) {
            const channelId = `chat-${conversationId}`;
            return supabase.channel(channelId)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                }, callback)
                .subscribe();
        },

        async unsubscribe(subscription) {
            if (subscription) {
                await supabase.removeChannel(subscription);
            }
        },
        subscribeToPresence(callback) {
            const channel = supabase.channel('online-users');
            channel.on('presence', { event: 'sync' }, callback);
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: state.currentUser.id, online_at: new Date().toISOString() });
                }
            });
            return channel;
        },
        async sendFriendRequestByUsername(username) {
            if (!state.currentUser || !state.currentUser.profile) throw new Error("Mevcut kullanıcı veya profili bulunamadı.");
            if (username.toLowerCase() === state.currentUser.profile.username.toLowerCase()) {
                return { success: false, message: 'Kendinizi arkadaş olarak ekleyemezsiniz.' };
            }

            const { data: targetUser, error: findError } = await supabase
                .from('profiles')
                .select('id, username')
                .ilike('username', username)
                .single();

            if (findError || !targetUser) {
                console.error('Error finding user:', findError);
                return { success: false, message: `'${username}' adında bir kullanıcı bulunamadı.` };
            }

            const targetUserId = targetUser.id;
            const currentUserId = state.currentUser.id;

            const { data: existingFriendship, error: checkError } = await supabase
                .from('friendships')
                .select('status')
                .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${targetUserId}),and(user_id_1.eq.${targetUserId},user_id_2.eq.${currentUserId})`)
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // 'No rows found' hatasını yoksay
                console.error('Error checking friendship:', checkError);
                return { success: false, message: 'Arkadaşlık durumu kontrol edilirken bir hata oluştu.' };
            }

            if (existingFriendship) {
                if (existingFriendship.status === 'accepted') {
                    return { success: false, message: 'Bu kullanıcı ile zaten arkadaşsınız.' };
                }
                if (existingFriendship.status === 'pending') {
                    return { success: false, message: 'Bu kullanıcıya zaten bir istek gönderilmiş.' };
                }
            }

            const { error: insertError } = await supabase
                .from('friendships')
                .insert({ user_id_1: currentUserId, user_id_2: targetUserId, status: 'pending' });

            if (insertError) {
                console.error('Error sending friend request:', insertError);
                return { success: false, message: 'Arkadaşlık isteği gönderilirken bir hata oluştu.' };
            }

            return { success: true, message: `'${targetUser.username}' kullanıcısına istek gönderildi!` };
        }
    };

    // --- 4. UI RENDERER ---
    const renderer = {
        renderFriendsList() {
            console.log("Arkadaş listesi render ediliyor...", state.friends);

            // Arkadaş listesi boşsa
            if (!state.friends || state.friends.length === 0) {
                if (ui.onlineFriendsList) ui.onlineFriendsList.innerHTML = '';
                if (ui.offlineFriendsList) ui.offlineFriendsList.innerHTML = '';
                if (ui.onlineCount) ui.onlineCount.textContent = '0';
                if (ui.offlineCount) ui.offlineCount.textContent = '0';
                if (ui.onlineSectionTitle) ui.onlineSectionTitle.style.display = 'none';
                if (ui.offlineSectionTitle) ui.offlineSectionTitle.style.display = 'none';

                // DM listesini de temizle
                if (ui.dmList) ui.dmList.innerHTML = '';
                return;
            }

            // Çevrimiçi ve çevrimdışı arkadaşları ayır
            const onlineFriends = state.friends.filter(friend => state.onlineFriends.has(friend.id));
            const offlineFriends = state.friends.filter(friend => !state.onlineFriends.has(friend.id));

            // Çevrimiçi arkadaşlar bölümünü güncelle
            if (ui.onlineFriendsList) {
                ui.onlineFriendsList.innerHTML = '';
                onlineFriends.forEach(friend => {
                    console.log("Arkadaş render ediliyor:", friend);
                    const friendEl = document.createElement('div');
                    friendEl.className = 'friend-item';
                    friendEl.dataset.userId = friend.id;
                    friendEl.innerHTML = `
                        <div class="friend-info">
                            <div class="friend-avatar">
                                <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}" onerror="this.src='images/defaultavatar.png';">
                                <div class="friend-status online"></div>
                            </div>
                            <div class="friend-details">
                                <div class="friend-name">${friend.username}</div>
                                <div class="friend-status-text">Çevrimiçi</div>
                            </div>
                        </div>
                        <div class="friend-actions">
                            <button class="btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment"></i></button>
                            <button class="btn profile-btn" title="Profili Görüntüle"><i class="fas fa-user"></i></button>
                        </div>`;
                    ui.onlineFriendsList.appendChild(friendEl);
                });
            }

            // Çevrimdışı arkadaşlar bölümünü güncelle
            if (ui.offlineFriendsList) {
                ui.offlineFriendsList.innerHTML = '';
                offlineFriends.forEach(friend => {
                    console.log("Arkadaş render ediliyor:", friend);
                    const friendEl = document.createElement('div');
                    friendEl.className = 'friend-item';
                    friendEl.dataset.userId = friend.id;
                    friendEl.innerHTML = `
                        <div class="friend-info">
                            <div class="friend-avatar">
                                <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}" onerror="this.src='images/defaultavatar.png';">
                                <div class="friend-status offline"></div>
                            </div>
                            <div class="friend-details">
                                <div class="friend-name">${friend.username}</div>
                                <div class="friend-status-text">Çevrimdışı</div>
                            </div>
                        </div>
                        <div class="friend-actions">
                            <button class="btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment"></i></button>
                            <button class="btn profile-btn" title="Profili Görüntüle"><i class="fas fa-user"></i></button>
                        </div>`;
                    ui.offlineFriendsList.appendChild(friendEl);
                });
            }

            // Sayıları güncelle
            if (ui.onlineCount) ui.onlineCount.textContent = onlineFriends.length;
            if (ui.offlineCount) ui.offlineCount.textContent = offlineFriends.length;

            // Bölüm başlıklarını göster/gizle
            if (ui.onlineSectionTitle) {
                ui.onlineSectionTitle.style.display = onlineFriends.length > 0 ? 'flex' : 'none';
            }
            if (ui.offlineSectionTitle) {
                ui.offlineSectionTitle.style.display = offlineFriends.length > 0 ? 'flex' : 'none';
            }

            // DM listesini güncelle
            this.updateDMList();

            console.log("Arkadaş listesi güncellendi:", onlineFriends.length, "çevrimiçi,", offlineFriends.length, "çevrimdışı");
        },

        async renderPendingRequests() {
            console.log("Bekleyen istekler yenileniyor...");
            try {
                if (!state.currentUser) return;

                // Bekleyen istekleri getir
                const pendingRequests = await supabaseService.getPendingRequests(state.currentUser.id);

                // Önceki isteklerle karşılaştır ve değişiklik yoksa güncelleme yapma
                if (JSON.stringify(pendingRequests) === JSON.stringify(state.pendingRequests)) {
                    console.log("Bekleyen isteklerde değişiklik yok, güncelleme yapılmıyor");
                    return;
                }

                state.pendingRequests = pendingRequests || [];
                console.log("Bekleyen istekler güncellendi:", pendingRequests);

                // UI'ı güncelle
                if (ui.pendingRequestsList) {
                    console.log("Bekleyen istekler:", pendingRequests);
                    ui.pendingRequestsList.innerHTML = '';

                    pendingRequests.forEach(request => {
                        const requestEl = this.createPendingRequestRow(request);
                        ui.pendingRequestsList.appendChild(requestEl);
                    });

                    // Bekleyen isteklerin sayısını güncelle
                    if (ui.pendingCount) {
                        ui.pendingCount.textContent = pendingRequests.length;
                    }

                    // Bekleyen istekler bölümünü göster/gizle
                    if (ui.pendingSectionTitle) {
                        ui.pendingSectionTitle.style.display = pendingRequests.length > 0 ? 'block' : 'none';
                    }
                }
            } catch (error) {
                console.error("Bekleyen istekler güncellenirken hata:", error);
            }
        },

        createPendingRequestRow(request) {
            console.log("Bekleyen istek satırı oluşturuluyor:", request);

            const el = document.createElement('div');
            el.className = 'friend-request-item';
            el.dataset.requestId = request.id;
            el.dataset.userId = request.userId;

            // Tarih formatını ayarla
            const requestDate = new Date(request.createdAt);
            const formattedDate = new Intl.DateTimeFormat('tr-TR', {
                day: 'numeric',
                month: 'short'
            }).format(requestDate);

            el.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar">
                        <img src="${request.avatarUrl || 'images/defaultavatar.png'}" alt="${request.username}" onerror="this.src='images/defaultavatar.png';">
                    </div>
                    <div class="friend-details">
                        <div class="friend-name">${request.username}</div>
                        <div class="friend-status-text">${formattedDate} tarihinde istek gönderdi</div>
                    </div>
                </div>
                <div class="friend-request-actions">
                    <button class="btn accept-btn" title="Kabul Et"><i class="fas fa-check"></i></button>
                    <button class="btn reject-btn" title="Reddet"><i class="fas fa-times"></i></button>
                </div>`;

            console.log("Oluşturulan bekleyen istek satırı:", el.outerHTML);
            return el;
        },

        createFriendRow(friend, isOnline) {
            const el = document.createElement('div');
            el.className = `friend-item ${isOnline ? 'online' : ''}`;
            el.dataset.userId = friend.id;
            el.innerHTML = `
                <div class="friend-info">
        <div class="friend-avatar">
                        <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}">
                        <div class="status-dot ${isOnline ? 'online' : ''}"></div>
        </div>
                    <div class="friend-details">
                        <div class="friend-name">${friend.username}</div>
                        <div class="friend-status-text">${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
        </div>
        </div>
                <div class="friend-actions">
                    <button class="btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment"></i></button>
                    <button class="btn profile-btn" title="Profili Görüntüle"><i class="fas fa-user"></i></button>
                    <button class="btn more-btn" title="Daha Fazla"><i class="fas fa-ellipsis-v"></i></button>
                </div>`;
            return el;
        },
        createDMRow(friend, isOnline) {
            const el = document.createElement('div');
            el.className = 'dm-item';
            el.dataset.userId = friend.id;
            el.innerHTML = `
        <div class="dm-avatar">
                    <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}">
            <div class="dm-status ${isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="dm-info">
                    <div class="dm-name">${friend.username}</div>
                </div>`;
            return el;
        },
        async renderChatPanel(friendId) {
            console.log("Sohbet paneli açılıyor, friendId:", friendId);

            // Önce arkadaş listesinden arkadaşı bul
            let friend = state.friends.find(f => f.id === friendId);

            // Eğer arkadaş listesinde yoksa, profili getir
            if (!friend) {
                console.log("Arkadaş listesinde bulunamadı, profil getiriliyor:", friendId);
                friend = await supabaseService.getUserProfile(friendId);

                if (!friend) {
                    console.error("Sohbet edilecek arkadaş bulunamadı:", friendId);
                    return;
                }

                console.log("Arkadaş profili alındı:", friend);

                // Arkadaş listesine ekle (eğer yeni kabul edildiyse)
                if (!state.friends.some(f => f.id === friendId)) {
                    state.friends.push(friend);
                    // Arkadaş listesini güncelle
                    renderer.renderFriendsList();
                }
            }

            // Update header
            ui.chatHeaderUser.querySelector('.chat-username').textContent = friend.username || "İsimsiz Kullanıcı";
            const avatarImg = ui.chatHeaderUser.querySelector('.chat-avatar img');
            avatarImg.src = friend.avatar_url || 'images/defaultavatar.png';
            avatarImg.onerror = function () {
                this.src = 'images/defaultavatar.png';
            };

            console.log("Sohbet paneli başlığı güncellendi");

            // Show/Hide panels
            ui.friendsPanel.classList.add('hidden');
            if (ui.sponsorServersContainer) ui.sponsorServersContainer.classList.add('hidden');
            ui.chatPanel.classList.remove('hidden');

            console.log("Paneller güncellendi");

            // Unsubscribe from any previous chat channel to prevent multiple listeners
            if (state.messageSubscription) {
                await supabaseService.unsubscribe(state.messageSubscription);
                state.messageSubscription = null;
            }

            try {
                // Find conversation, fetch messages, and subscribe to new ones
                console.log("Konuşma oluşturuluyor/bulunuyor...");
                const conversationId = await supabaseService.findOrCreateConversation(state.currentUser.id, friendId);
                console.log("Konuşma ID:", conversationId);
                state.currentConversationId = conversationId;

                console.log("Mesajlar getiriliyor...");
                const messages = await supabaseService.getMessages(conversationId);
                console.log("Mesajlar:", messages);
                renderer.renderMessages(messages);

                // Subscribe to new messages for this conversation
                console.log("Mesaj aboneliği oluşturuluyor...");
                state.messageSubscription = supabaseService.subscribeToMessages(conversationId, async (payload) => {
                    console.log("Yeni mesaj alındı:", payload);
                    const newMessage = payload.new;

                    // Optimistic UI handles the sender's own messages, so we only need to render messages from others.
                    if (newMessage.sender_id === state.currentUser.id) {
                        return;
                    }

                    // Since it's not our message, the sender must be the friend we're chatting with.
                    const senderProfile = friend;
                    renderer.appendMessage({ ...newMessage, sender: senderProfile });
                });

                console.log("Sohbet paneli başarıyla açıldı");
            } catch (error) {
                console.error("Sohbet paneli açılırken hata:", error);
            }
        },

        renderMessages(messages) {
            ui.chatMessages.innerHTML = '';
            messages.forEach(msg => renderer.appendMessage(msg));
        },

        appendMessage(msg) {
            const isOwn = msg.sender_id === state.currentUser.id;
            // For optimistic updates, msg.sender might not exist yet. We use currentUser.profile.
            // For received messages, msg.sender will be populated by the getMessages service.
            const senderProfile = isOwn ? state.currentUser.profile : msg.sender;

            if (!senderProfile) {
                console.error("Cannot render message, sender profile is missing:", msg);
                return;
            }

            const el = document.createElement('div');
            el.className = `message-group ${isOwn ? 'own-message' : ''}`;

            // Use created_at for DB records, and createdAt for optimistic local messages
            const messageTime = new Date(msg.created_at || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            el.innerHTML = `
                <div class="message-group-avatar"><img src="${senderProfile.avatar_url || 'images/defaultavatar.png'}" alt=""></div>
                <div class="message-group-content">
                    <div class="message-group-header">
                        <span class="message-author">${isOwn ? 'Sen' : senderProfile.username}</span>
                        <span class="message-time">${messageTime}</span>
                    </div>
                    <div class="message-content"><p>${msg.content}</p></div>
                </div>`;

            // For own messages, hide avatar and name for a cleaner look
            if (isOwn) {
                const authorSpan = el.querySelector('.message-author');
                if (authorSpan) authorSpan.style.display = 'none';
            }

            ui.chatMessages.appendChild(el);
            // Scroll to the bottom to show the new message
            ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
        },

        renderProfilePanel: (profile) => {
            if (!profile) return;

            ui.profileModal.avatar.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=${profile.avatar_color || '3498db'}&color=fff&size=100`;
            ui.profileModal.username.textContent = profile.username || 'Kullanıcı Adı Yok';

            const friend = state.friends.find(f => f.id === profile.id);
            const status = friend ? friend.status : 'offline';
            if (ui.profileModal.statusDot) {
                ui.profileModal.statusDot.className = `status-dot-modal ${status}`;
            }
            if (ui.profileModal.statusText) {
                const statusMap = {
                    online: 'Çevrimiçi',
                    offline: 'Çevrimdışı',
                    idle: 'Boşta',
                    dnd: 'Rahatsız Etmeyin'
                };
                ui.profileModal.statusText.textContent = statusMap[status] || 'Çevrimdışı';
            }

            ui.profileModal.bio.textContent = profile.bio || 'Bu kullanıcı henüz hakkında bir şey yazmamış.';

            const joinDate = new Date(profile.created_at).toLocaleDateString('tr-TR', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            ui.profileModal.memberSince.textContent = joinDate || 'Bilinmiyor';

            ui.profileModal.badgesContainer.innerHTML = '';
            if (profile.is_nitro) {
                const nitroBadge = document.createElement('i');
                nitroBadge.className = 'fas fa-gem';
                nitroBadge.title = 'Chatlify Nitro';
                ui.profileModal.badgesContainer.appendChild(nitroBadge);
            }

            if (ui.profileModal.container) {
                ui.profileModal.container.classList.add('is-visible');
            } else {
                console.error("HATA: profile-modal-container elementi bulunamadı!");
            }
        },

        updateUserFooter(profile) {
            ui.userFooterName.textContent = profile.username;
            ui.userFooterAvatar.src = profile.avatar_url || 'images/defaultavatar.png';
        },
        updateDMList() {
            if (!ui.dmList || !state.friends) return;

            console.log("DM listesi güncelleniyor...");
            ui.dmList.innerHTML = '';

            state.friends.forEach(friend => {
                const isOnline = state.onlineFriends.has(friend.id);
                const dmItem = document.createElement('div');
                dmItem.className = 'dm-item';
                dmItem.dataset.userId = friend.id;
                dmItem.innerHTML = `
                    <div class="dm-avatar">
                        <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}" onerror="this.src='images/defaultavatar.png';">
                        <div class="dm-status ${isOnline ? 'online' : 'offline'}"></div>
                    </div>
                    <div class="dm-info">
                        <div class="dm-name">${friend.username}</div>
                    </div>`;

                ui.dmList.appendChild(dmItem);
            });

            console.log("DM listesi güncellendi");
        }
    };

    // --- 5. EVENT HANDLERS & INITIALIZATION ---
    const initEventListeners = () => {

        if (ui.sidebarToggleButton) {
            ui.sidebarToggleButton.addEventListener('click', () => {
                const isCollapsed = ui.serverSidebar.classList.toggle('sidebar-collapsed');
                document.body.classList.toggle('sidebar-closed', isCollapsed);
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            });
        }

        if (ui.friendsListContainer) {
            ui.friendsListContainer.addEventListener('click', handleFriendAction);
        }

        // Tab değiştirme olayını dinle
        const tabsContainer = document.querySelector('.tabs-container');
        if (tabsContainer) {
            tabsContainer.addEventListener('click', handleTabChange);
        }

        // Bekleyen istekleri işleme
        if (ui.pendingRequestsList) {
            ui.pendingRequestsList.addEventListener('click', handlePendingRequestAction);
        }

        ui.dmList?.addEventListener('click', (e) => {
            const target = e.target.closest('.dm-item');
            if (target) {
                renderer.renderChatPanel(target.dataset.userId);
            }
        });

        ui.chatCloseBtn?.addEventListener('click', async () => {
            ui.chatPanel.classList.add('hidden');
            ui.friendsPanel.classList.remove('hidden');
            if (ui.sponsorServersContainer) ui.sponsorServersContainer.classList.remove('hidden');
            if (state.messageSubscription) {
                await supabaseService.unsubscribe(state.messageSubscription);
                state.messageSubscription = null;
            }
            state.currentConversationId = null;
        });

        ui.chatSendBtn?.addEventListener('click', handleSendMessage);
        ui.chatInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        ui.chatInput?.addEventListener('input', () => {
            ui.chatInput.style.height = 'auto';
            ui.chatInput.style.height = `${ui.chatInput.scrollHeight}px`;
        });

        if (ui.profileModal.closeBtn) {
            ui.profileModal.closeBtn.addEventListener('click', () => {
                if (ui.profileModal.container) {
                    ui.profileModal.container.classList.remove('is-visible');
                }
            });
        }

        if (ui.profileModal.container) {
            ui.profileModal.container.addEventListener('click', (e) => {
                if (e.target === ui.profileModal.container) {
                    ui.profileModal.container.classList.remove('is-visible');
                }
            });
        }

        if (ui.userFooter) ui.userFooter.addEventListener('click', () => openProfileModal(state.currentUser.id));

        // Sohbet panelindeki profil butonuna tıklama olayı
        if (ui.chatProfileBtn) {
            ui.chatProfileBtn.addEventListener('click', () => {
                if (state.currentUser) {
                    openProfileModal(state.currentUser.id);
                }
            });
        }

    };

    const handleTabChange = (e) => {
        const tabButton = e.target.closest('.tab');
        if (!tabButton) return;

        // Tüm tabları pasif yap
        const allTabs = document.querySelectorAll('.tabs-container .tab');
        allTabs.forEach(tab => tab.classList.remove('active'));

        // Tıklanan tabı aktif yap
        tabButton.classList.add('active');

        // Tab içeriğini göster/gizle
        const tabText = tabButton.textContent.trim().toLowerCase();

        // Arkadaş listesi panellerini gizle
        ui.onlineSectionTitle.style.display = 'none';
        ui.offlineSectionTitle.style.display = 'none';
        ui.pendingSectionTitle.style.display = 'none';
        ui.onlineFriendsList.style.display = 'none';
        ui.offlineFriendsList.style.display = 'none';
        ui.pendingRequestsList.style.display = 'none';

        if (tabText === 'tüm arkadaşlar') {
            // Tüm arkadaşları göster
            if (state.friends.some(f => state.onlineFriends.has(f.id))) {
                ui.onlineSectionTitle.style.display = 'flex';
                ui.onlineFriendsList.style.display = 'block';
            }
            if (state.friends.some(f => !state.onlineFriends.has(f.id))) {
                ui.offlineSectionTitle.style.display = 'flex';
                ui.offlineFriendsList.style.display = 'block';
            }
        } else if (tabText === 'çevrimiçi') {
            // Sadece çevrimiçi arkadaşları göster
            if (state.friends.some(f => state.onlineFriends.has(f.id))) {
                ui.onlineSectionTitle.style.display = 'flex';
                ui.onlineFriendsList.style.display = 'block';
            }
        } else if (tabText === 'bekleyen') {
            // Bekleyen istekleri göster ve yenile
            renderer.renderPendingRequests();
            ui.pendingRequestsList.style.display = 'block';
        }
    };

    const handlePendingRequestAction = async (e) => {
        const acceptBtn = e.target.closest('.accept-btn');
        const rejectBtn = e.target.closest('.reject-btn');

        if (!acceptBtn && !rejectBtn) return;

        const requestItem = e.target.closest('.friend-request-item');
        if (!requestItem) return;

        const requestId = parseInt(requestItem.dataset.requestId);
        const userId = requestItem.dataset.userId;

        try {
            if (acceptBtn) {
                console.log("Arkadaşlık isteği kabul ediliyor, requestId:", requestId, "userId:", userId);

                // Önce butonu devre dışı bırak
                acceptBtn.disabled = true;
                acceptBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                // Kabul butonunu da devre dışı bırak
                const rejectBtnEl = requestItem.querySelector('.reject-btn');
                if (rejectBtnEl) rejectBtnEl.disabled = true;

                // İsteği kabul et
                const result = await supabaseService.acceptFriendRequest(requestId);

                // Başarılı olsa da olmasa da, UI'ı güncelle (optimistik güncelleme)
                console.log("Arkadaşlık isteği kabul edildi sonucu:", result);

                // Başarıyla kabul edildi, UI'ı güncelle
                requestItem.classList.add('accepted');

                // İstek gönderen kullanıcının profilini al
                const senderProfile = await supabaseService.getUserProfile(userId);
                if (senderProfile) {
                    console.log("Arkadaş listesine ekleniyor:", senderProfile);

                    // Arkadaşı listeye ekle
                    if (!state.friends.some(f => f.id === senderProfile.id)) {
                        state.friends.push(senderProfile);
                        // Arkadaş listesini ve DM listesini yeniden render et
                        renderer.renderFriendsList();
                    }
                }

                // Bekleyen istekleri listeden kaldır
                setTimeout(() => {
                    requestItem.remove();

                    // Bekleyen istekler listesini güncelle
                    state.pendingRequests = state.pendingRequests.filter(req => req.id !== requestId);

                    // Bekleyen isteklerin sayısını güncelle
                    if (ui.pendingCount) {
                        const newCount = parseInt(ui.pendingCount.textContent) - 1;
                        ui.pendingCount.textContent = newCount;

                        // Eğer bekleyen istek kalmadıysa başlığı gizle
                        if (newCount <= 0 && ui.pendingSectionTitle) {
                            ui.pendingSectionTitle.style.display = 'none';
                        }
                    }

                    // Kabul edilen kullanıcıyla sohbet başlatma seçeneği sun
                    showFriendAcceptedNotification(userId);
                }, 500);

                // İşlem başarısız olduysa kullanıcıya bildir
                if (!result.success) {
                    console.error("Arkadaşlık isteği kabul edilemedi:", result);
                    // Toast mesajı göster
                    showToast("Arkadaşlık isteği kabul edilirken bir sorun oluştu, ancak işlem devam ediyor.", "warning");
                }
            } else if (rejectBtn) {
                // İsteği reddet
                rejectBtn.disabled = true;
                rejectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                // Kabul butonunu da devre dışı bırak
                const acceptBtnEl = requestItem.querySelector('.accept-btn');
                if (acceptBtnEl) acceptBtnEl.disabled = true;

                try {
                    const result = await supabaseService.rejectFriendRequest(requestId);

                    // Başarılı olsa da olmasa da, UI'ı güncelle (optimistik güncelleme)
                    console.log("Arkadaşlık isteği reddetme sonucu:", result);

                    // Başarıyla reddedildi, UI'ı güncelle
                    requestItem.classList.add('rejected');
                    setTimeout(() => {
                        requestItem.remove();

                        // Bekleyen istekler listesini güncelle
                        state.pendingRequests = state.pendingRequests.filter(req => req.id !== requestId);

                        // Bekleyen isteklerin sayısını güncelle
                        if (ui.pendingCount) {
                            const newCount = parseInt(ui.pendingCount.textContent) - 1;
                            ui.pendingCount.textContent = newCount;

                            // Eğer bekleyen istek kalmadıysa başlığı gizle
                            if (newCount <= 0 && ui.pendingSectionTitle) {
                                ui.pendingSectionTitle.style.display = 'none';
                            }
                        }
                    }, 500);

                    // İşlem başarısız olduysa kullanıcıya bildir
                    if (!result.success) {
                        console.error("Arkadaşlık isteği reddedilemedi:", result);
                        // Toast mesajı göster
                        showToast("Arkadaşlık isteği reddedilirken bir sorun oluştu, ancak işlem devam ediyor.", "warning");
                    }
                } catch (error) {
                    console.error("Arkadaşlık isteği reddedilirken hata:", error);
                    rejectBtn.disabled = false;
                    rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
                    if (acceptBtnEl) acceptBtnEl.disabled = false;
                    showToast("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.", "error");
                }
            }
        } catch (error) {
            console.error('Error handling friend request action:', error);
            if (acceptBtn) {
                acceptBtn.disabled = false;
                acceptBtn.innerHTML = '<i class="fas fa-check"></i>';
            }
            if (rejectBtn) {
                rejectBtn.disabled = false;
                rejectBtn.innerHTML = '<i class="fas fa-times"></i>';
            }
            // Hata mesajı göster
            showToast("İşlem sırasında bir hata oluştu. Lütfen tekrar deneyin.", "error");
        }
    };

    const showFriendAcceptedNotification = async (userId) => {
        console.log("Arkadaşlık isteği kabul bildirimini gösteriliyor, userId:", userId);
        try {
            // Kullanıcı profilini al
            const friendProfile = await supabaseService.getUserProfile(userId);
            if (!friendProfile) return;

            // Bildirim oluştur
            const notification = document.createElement('div');
            notification.className = 'friend-accepted-notification';
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fas fa-user-check"></i>
                    <span>${friendProfile.username} arkadaşlık isteğinizi kabul etti!</span>
                </div>
                <div class="notification-actions">
                    <button class="start-chat-btn" data-user-id="${friendProfile.id}">
                        <i class="fas fa-comment"></i>
                        <span>Sohbet Başlat</span>
                    </button>
                </div>
            `;

            // DOM'a ekle
            document.body.appendChild(notification);
            console.log("Bildirim DOM'a eklendi");

            // Animasyon için timeout
            setTimeout(() => {
                notification.classList.add('show');
                console.log("Bildirim gösteriliyor");
            }, 100);

            // Bildirim kapatma
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                    console.log("Bildirim kaldırıldı");
                }, 300);
            }, 8000);

            // Sohbet başlatma butonu olayı
            const startChatBtn = notification.querySelector('.start-chat-btn');
            startChatBtn.addEventListener('click', async () => {
                try {
                    // Sohbet panelini aç
                    await renderer.renderChatPanel(friendProfile.id);

                    // Bildirim kapat
                    notification.classList.remove('show');
                    setTimeout(() => {
                        notification.remove();
                    }, 300);
                } catch (error) {
                    console.error('Error starting chat:', error);
                }
            });
        } catch (error) {
            console.error("Bildirim gösterilirken hata:", error);
        }
    };

    const handleFriendAction = async (e) => {
        const button = e.target.closest('.btn');
        if (!button) return;

        const friendItem = e.target.closest('.friend-item');
        if (!friendItem) return;

        const userId = friendItem.dataset.userId;

        if (button.classList.contains('profile-btn')) {
            const profile = await supabaseService.getUserProfile(userId);
            if (profile) {
                renderer.renderProfilePanel(profile);
            } else {
                console.error("Profil bilgisi alınamadı.");
            }
        }
        if (button.classList.contains('message-btn')) {
            await renderer.renderChatPanel(userId);
        }
    };

    const handleSendMessage = async () => {
        const content = ui.chatInput.value.trim();
        if (content && state.currentConversationId) {
            const tempMessage = {
                sender_id: state.currentUser.id,
                content: content,
                createdAt: new Date().toISOString(), // Use createdAt for local optimistic message
            };

            renderer.appendMessage(tempMessage);

            ui.chatInput.value = '';
            ui.chatInput.style.height = 'auto'; // Reset height after sending

            try {
                await supabaseService.sendMessage(state.currentConversationId, state.currentUser.id, content);
            } catch (error) {
                console.error("Failed to send message:", error);
            }
        }
    };

    // --- 6. INITIALIZATION ---
    const fetchAndRenderFriends = async () => {
        if (!state.currentUser) {
            console.log("User not available for fetching friends.");
            return;
        }
        try {
            const friends = await supabaseService.getFriends(state.currentUser.id);
            state.friends = friends || [];
            renderer.renderFriendsList();
        } catch (error) {
            console.error("Error fetching and rendering friends:", error);
        }
    };

    const initAddFriendModal = () => {
        if (!ui.addFriendModal.container || !ui.addFriendModal.button) {
            console.log('Arkadaş ekleme butonu veya konteyneri bulunamadı, bu özellik atlanıyor.');
            return;
        }

        fetch('add-friend.html')
            .then(response => response.ok ? response.text() : Promise.reject(response.statusText))
            .then(html => {
                ui.addFriendModal.container.innerHTML = html;

                ui.addFriendModal.overlay = document.getElementById('add-friend-modal');
                ui.addFriendModal.form = document.getElementById('add-friend-form');
                ui.addFriendModal.input = document.getElementById('add-friend-username-input');
                ui.addFriendModal.statusMessage = document.getElementById('friend-request-status');
                ui.addFriendModal.closeBtn = document.querySelector('#add-friend-modal .close-modal-btn');

                ui.addFriendModal.button.addEventListener('click', openAddFriendModal);
                ui.addFriendModal.closeBtn.addEventListener('click', closeAddFriendModal);
                ui.addFriendModal.overlay.addEventListener('click', (e) => {
                    if (e.target === ui.addFriendModal.overlay) closeAddFriendModal();
                });
                ui.addFriendModal.form.addEventListener('submit', handleSendFriendRequest);
            })
            .catch(error => console.error('Arkadaş ekleme modal HTML yüklenirken hata:', error));
    };

    const openAddFriendModal = () => {
        if (!ui.addFriendModal.overlay) return;
        ui.addFriendModal.overlay.style.display = 'flex';
        setTimeout(() => {
            ui.addFriendModal.overlay.classList.add('active');
            ui.addFriendModal.input.focus();
        }, 10);
    };

    const closeAddFriendModal = () => {
        if (!ui.addFriendModal.overlay) return;
        ui.addFriendModal.overlay.classList.remove('active');
        setTimeout(() => {
            ui.addFriendModal.overlay.style.display = 'none';
            ui.addFriendModal.form.reset();
            const status = ui.addFriendModal.statusMessage;
            status.textContent = '';
            status.className = 'status-message';
        }, 300);
    };

    const openProfileModal = async (userId) => {
        const profile = await supabaseService.getUserProfile(userId);
        if (profile) {
            renderer.renderProfilePanel(profile);
            ui.friendProfilePanel.style.display = 'block';
            ui.friendProfileModalOverlay.style.display = 'block';
        }
    };

    const handleSendFriendRequest = async (e) => {
        e.preventDefault();
        const username = ui.addFriendModal.input.value.trim();
        const statusEl = ui.addFriendModal.statusMessage;

        if (!username) return;

        statusEl.textContent = 'İstek gönderiliyor...';
        statusEl.className = 'status-message info';

        try {
            const result = await supabaseService.sendFriendRequestByUsername(username);
            statusEl.textContent = result.message;
            statusEl.className = `status-message ${result.success ? 'success' : 'error'}`;

            if (result.success) {
                ui.addFriendModal.input.value = '';
            }
        } catch (error) {
            statusEl.textContent = 'Beklenmedik bir hata oluştu.';
            statusEl.className = 'status-message error';
            console.error('Error handling friend request:', error);
        }
    };

    const showToast = (message, type = "info") => {
        // Toast container oluştur veya varsa al
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // Toast elementini oluştur
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' :
                    type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close"><i class="fas fa-times"></i></button>
        `;

        // Toast'u container'a ekle
        toastContainer.appendChild(toast);

        // Toast'u göster
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        // Kapatma butonu olayı
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });
        }

        // Otomatik kapanma
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('show');
                setTimeout(() => {
                    if (toast.parentElement) toast.remove();
                }, 300);
            }
        }, 5000);
    };

    const init = async () => {
        state.currentUser = await supabaseService.getUserSession();
        if (!state.currentUser) return;

        const profile = await supabaseService.getUserProfile(state.currentUser.id);
        if (profile) {
            state.currentUser.profile = profile;
            renderer.updateUserFooter(profile);
        }

        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed');
        if (sidebarCollapsed === 'true') {
            document.body.classList.add('sidebar-closed');
            if (ui.serverSidebar) ui.serverSidebar.classList.add('sidebar-collapsed');
        } else if (sidebarCollapsed === 'false') {
            document.body.classList.remove('sidebar-closed');
            if (ui.serverSidebar) ui.serverSidebar.classList.remove('sidebar-collapsed');
        }

        initEventListeners();
        initAddFriendModal(); // Arkadaş ekle modalını başlat

        // Arkadaş listesini ve bekleyen istekleri yükle
        try {
            console.log("Arkadaş listesi yükleniyor...");
            const friends = await supabaseService.getFriends(state.currentUser.id);
            state.friends = friends || [];
            renderer.renderFriendsList();

            console.log("Bekleyen istekler yükleniyor...");
            await renderer.renderPendingRequests();
        } catch (error) {
            console.error("Arkadaş listesi veya bekleyen istekler yüklenirken hata:", error);
        }

        // Çevrimiçi durumunu izle
        state.presenceChannel = supabaseService.subscribeToPresence(() => {
            state.onlineFriends.clear();
            const presenceState = state.presenceChannel.state;
            for (const id in presenceState) {
                if (presenceState[id] && presenceState[id][0]) {
                    state.onlineFriends.add(presenceState[id][0].user_id);
                }
            }
            renderer.renderFriendsList();
        });

        // Arkadaşlık değişikliklerini dinleyen kanalları tanımla
        const friendshipsChannel = supabase.channel('friendships-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `user_id_2=eq.${state.currentUser.id}`
            }, async (payload) => {
                console.log("Arkadaşlık tablosunda değişiklik algılandı:", payload);

                // Değişiklik olduğunda bekleyen istekleri ve arkadaş listesini yenile
                await renderer.renderPendingRequests();

                // Eğer bir istek kabul edildiyse, arkadaş listesini güncelle
                if (payload.new && payload.new.status === 'accepted') {
                    console.log("Arkadaşlık isteği kabul edildi (postgres değişikliği)");
                    const friends = await supabaseService.getFriends(state.currentUser.id);
                    state.friends = friends || [];
                    renderer.renderFriendsList();
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friendships',
                filter: `user_id_1=eq.${state.currentUser.id}`
            }, async (payload) => {
                console.log("Gönderilen arkadaşlık isteğinde değişiklik algılandı:", payload);

                // Eğer bir istek kabul edildiyse, arkadaş listesini güncelle
                if (payload.new && payload.new.status === 'accepted') {
                    console.log("Gönderilen arkadaşlık isteği kabul edildi (postgres değişikliği)");
                    const friends = await supabaseService.getFriends(state.currentUser.id);
                    state.friends = friends || [];
                    renderer.renderFriendsList();

                    // Karşı tarafın profil bilgilerini al ve bildirim göster
                    const friendProfile = await supabaseService.getUserProfile(payload.new.user_id_2);
                    if (friendProfile) {
                        showFriendAcceptedNotification(friendProfile.id);
                    }
                }
            })
            .subscribe((status) => {
                console.log(`Arkadaşlık değişiklikleri abonelik durumu: ${status}`);
            });

        // Arkadaşlık güncellemelerini dinle
        const friendshipUpdatesChannel = supabase.channel(`friendship_updates_${state.currentUser.id}`);
        friendshipUpdatesChannel
            .on('broadcast', { event: 'friendship_update' }, async (payload) => {
                console.log("Arkadaşlık güncellemesi alındı:", payload);

                // Arkadaşlık isteği kabul edildiyse
                if (payload.payload && payload.payload.type === 'friendship_accepted') {
                    console.log("Arkadaşlık isteği kabul edildi bildirimi alındı");

                    try {
                        // Arkadaş listesini güncelle
                        const friends = await supabaseService.getFriends(state.currentUser.id);
                        state.friends = friends || [];
                        renderer.renderFriendsList();

                        // Bekleyen istekleri yenile
                        await renderer.renderPendingRequests();

                        // Eğer istek gönderen kullanıcıysak, bildirim göster
                        if (payload.payload.user_id_1 === state.currentUser.id) {
                            // Karşı tarafın profil bilgilerini al
                            const friendProfile = await supabaseService.getUserProfile(payload.payload.user_id_2);
                            if (friendProfile) {
                                showFriendAcceptedNotification(friendProfile.id);
                            }
                        }
                    } catch (error) {
                        console.error("Arkadaşlık güncellemesi işlenirken hata:", error);
                    }
                }
            })
            .subscribe((status) => {
                console.log(`Arkadaşlık güncellemeleri abonelik durumu: ${status}`);
            });
    };

    await init();
});