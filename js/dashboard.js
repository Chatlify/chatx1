import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. STATE MANAGEMENT ---
        const state = {
        currentUser: null,
        currentConversationId: null,
        messageSubscription: null, // Holds the current real-time subscription
        friends: [],
        onlineFriends: new Set(),
        presenceChannel: null,
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
        }
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
            const { data, error } = await supabase
                .from('friendships')
                .select('user_id_1, user_id_2, profiles_1:user_id_1(id, username, avatar_url), profiles_2:user_id_2(id, username, avatar_url)')
                .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
                .eq('status', 'accepted');
            if (error) {
                console.error('Error fetching friends:', error);
                return [];
            }
            return data.map(f => f.user_id_1 === userId ? f.profiles_2 : f.profiles_1);
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
            ui.onlineFriendsList.innerHTML = '';
            ui.offlineFriendsList.innerHTML = '';
            ui.dmList.innerHTML = '';

            let onlineCount = 0;
            let offlineCount = 0;

            state.friends.forEach(friend => {
                const isOnline = state.onlineFriends.has(friend.id);
                const friendRow = this.createFriendRow(friend, isOnline);
                const dmRow = this.createDMRow(friend, isOnline);

                if (isOnline) {
                    ui.onlineFriendsList.appendChild(friendRow);
                    onlineCount++;
                } else {
                    ui.offlineFriendsList.appendChild(friendRow);
                    offlineCount++;
                }
                ui.dmList.appendChild(dmRow);
            });

            ui.onlineCount.textContent = onlineCount;
            ui.offlineCount.textContent = offlineCount;
            ui.onlineSectionTitle.style.display = onlineCount > 0 ? 'flex' : 'none';
            ui.offlineSectionTitle.style.display = offlineCount > 0 ? 'flex' : 'none';
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
                    <button class="btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment-alt"></i></button>
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
            const friend = state.friends.find(f => f.id === friendId);
            if (!friend) {
                console.error("Sohbet edilecek arkadaş bulunamadı:", friendId);
                return;
            }

            // Update header
            ui.chatHeaderUser.querySelector('.chat-username').textContent = friend.username;
            ui.chatHeaderUser.querySelector('.chat-avatar img').src = friend.avatar_url || 'images/defaultavatar.png';

            // Show/Hide panels
            ui.friendsPanel.classList.add('hidden');
            if (ui.sponsorServersContainer) ui.sponsorServersContainer.classList.add('hidden');
            ui.chatPanel.classList.remove('hidden');

            // Unsubscribe from any previous chat channel to prevent multiple listeners
            if (state.messageSubscription) {
                await supabaseService.unsubscribe(state.messageSubscription);
                state.messageSubscription = null;
            }

            // Find conversation, fetch messages, and subscribe to new ones
            const conversationId = await supabaseService.findOrCreateConversation(state.currentUser.id, friendId);
            state.currentConversationId = conversationId;

            const messages = await supabaseService.getMessages(conversationId);
            renderer.renderMessages(messages);

            // Subscribe to new messages for this conversation
            state.messageSubscription = supabaseService.subscribeToMessages(conversationId, async (payload) => {
                const newMessage = payload.new;
                
                // Optimistic UI handles the sender's own messages, so we only need to render messages from others.
                if (newMessage.sender_id === state.currentUser.id) {
                    return;
                }

                // Since it's not our message, the sender must be the friend we're chatting with.
                const senderProfile = friend;
                renderer.appendMessage({ ...newMessage, sender: senderProfile });
            });
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
                if(authorSpan) authorSpan.style.display = 'none';
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
        await fetchAndRenderFriends();

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
    };

    await init();
});