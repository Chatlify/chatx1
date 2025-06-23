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
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
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
        chatPanel: document.querySelector('.chat-panel-container'), // Chat panel container
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
        friendsContentContainer: document.querySelector('.friends-content-container'),
        tabsContainer: document.querySelector('.tabs-container'),
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
                userId: req.profiles.id,
                username: req.profiles.username,
                avatarUrl: req.profiles.avatar_url,
                createdAt: req.created_at,
            }));
        },

        async acceptFriendRequest(requestId) {
            console.log(`Accepting friend request: ${requestId}`);
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
            const { data, error } = await supabase.rpc('get_or_create_conversation', {
                user_id_1: userId1,
                user_id_2: userId2
            });
            if (error) {
                console.error('Error getting or creating conversation:', error);
                return null;
            }
            return data;
        },

        async sendFriendRequestByUsername(username) {
            // ... (code for sending friend request)
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
                return `
                    <div class="friend-card" data-user-id="${friend.id}">
                        <div class="card-avatar">
                            <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}'s avatar">
                            <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                        </div>
                        <div class="card-username">${friend.username}</div>
                        <div class="card-actions">
                            <button class="card-action-btn" title="Mesaj Gönder"><i class="fas fa-comment-dots"></i></button>
                            <button class="card-action-btn" title="Daha Fazla"><i class="fas fa-ellipsis-v"></i></button>
                        </div>
                    </div>
                `;
            }).join('');

            ui.friendsContentContainer.innerHTML = `<div class="friends-grid">${gridHTML}</div>`;
        },

        renderPendingRequestCards() {
            const { pendingRequests } = state;

            if (pendingRequests.length === 0) {
                ui.friendsContentContainer.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>Bekleyen arkadaşlık isteğin yok.</p></div>`;
                return;
            }

            const requestsHTML = pendingRequests.map(req => `
                <div class="request-card" data-request-id="${req.id}">
                    <div class="request-card-info">
                        <img src="${req.avatarUrl || 'images/defaultavatar.png'}" alt="${req.username}'s avatar">
                        <span><strong>${req.username}</strong> sana bir istek gönderdi.</span>
                    </div>
                    <div class="request-card-actions">
                        <button class="accept-btn accept" title="Kabul Et"><i class="fas fa-check"></i></button>
                        <button class="reject-btn reject" title="Reddet"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `).join('');

            ui.friendsContentContainer.innerHTML = `<div class="pending-requests-container">${requestsHTML}</div>`;
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

        showChatPanel(friend, conversationId) {
            if (!ui.chatPanel) {
                console.error("Chat panel container not found!");
                return;
            }
            state.currentConversationId = conversationId; // Store the conversation ID

            // TODO: Render the chat panel content with friend's info
            console.log(`Showing chat for ${friend.username} (Conv ID: ${conversationId})`);

            ui.friendsPanel.style.display = 'none'; // Hide friends list
            ui.sponsorServersContainer.style.display = 'none';
            ui.chatPanel.style.display = 'flex'; // Show chat panel
        },
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
        const acceptBtn = e.target.closest('.accept-btn');
        const rejectBtn = e.target.closest('.reject-btn');

        if (!acceptBtn && !rejectBtn) {
            return; // Not an action button
        }

        const requestCard = e.target.closest('.request-card');
        if (!requestCard) {
            console.error('Request card not found for action button.');
            return;
        }

        const requestId = parseInt(requestCard.dataset.requestId, 10);
        if (isNaN(requestId)) {
            console.error('Invalid request ID:', requestCard.dataset.requestId);
            return;
        }

        // Disable buttons on the specific card to prevent multiple clicks
        requestCard.querySelectorAll('button').forEach(btn => btn.disabled = true);

        let result;
        if (acceptBtn) {
            result = await supabaseService.acceptFriendRequest(requestId);
        } else {
            result = await supabaseService.rejectFriendRequest(requestId);
        }

        if (!result.success) {
            alert("İşlem sırasında bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");
            // Re-enable buttons on failure
            requestCard.querySelectorAll('button').forEach(btn => btn.disabled = false);
        } else {
            // On success, switch to the 'all' tab to see the new friend
            // The real-time listener will handle the data refresh in the background,
            // but we can pre-emptively switch the tab for better UX.
            state.activeFriendsTab = 'all';
            fetchAndRenderAll(); // Explicitly call to re-render everything with the new state.
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
            state.currentUser = await supabaseService.getUserSession();
            if (!state.currentUser) return;

            const userProfile = await supabaseService.getUserProfile(state.currentUser.id);
            renderer.renderUserFooter(userProfile);

            await fetchAndRenderAll();

            // Setup Event Listeners using delegation where necessary
            if (ui.friendsContentContainer) {
                ui.friendsContentContainer.addEventListener('click', (e) => {
                    // Delegate clicks for pending request actions
                    if (e.target.closest('.accept-btn') || e.target.closest('.reject-btn')) {
                        handlePendingRequestAction(e);
                    }
                    // TODO: Delegate clicks for friend card actions here if needed
                });
            }

            if (ui.tabsContainer) {
                ui.tabsContainer.addEventListener('click', handleTabClick);
            }

            if (ui.dmList) {
                ui.dmList.addEventListener('click', handleDmItemClick);
            }

            const addFriendButton = document.getElementById('add-friend-button');
            if (addFriendButton) {
                addFriendButton.addEventListener('click', () => {
                    if (typeof window.initializeAddFriendPanel === 'function') {
                        // This function is in add-friend.js and handles showing the panel
                        window.initializeAddFriendPanel(supabase);
                    } else {
                        console.error('Arkadaş Ekle panelini başlatma fonksiyonu bulunamadı.');
                    }
                });
            }

            // Add navigation for sidebar buttons
            if (ui.settingsButton) {
                ui.settingsButton.addEventListener('click', () => { window.location.href = '/settings.html'; });
            }
            if (ui.shopButton) {
                ui.shopButton.addEventListener('click', () => { window.location.href = '/shop.html'; });
            }

            // Sidebar toggle button
            if (ui.sidebarToggleButton) {
                ui.sidebarToggleButton.addEventListener('click', () => {
                    document.body.classList.toggle('sidebar-closed');
                    ui.serverSidebar.classList.toggle('sidebar-collapsed');
                });
            }

            // Real-time subscriptions
            supabase.channel('public:friendships')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
                    console.log('Friendship table change detected, refetching all data.', payload);
                    fetchAndRenderAll();
                })
                .subscribe();

            // Real-time presence tracking
            if (state.currentUser) {
                const presenceChannel = supabase.channel(`user-presence:${state.currentUser.id}`, {
                    config: { presence: { key: state.currentUser.id } }
                });

                presenceChannel.on('presence', { event: 'sync' }, () => {
                    const newState = presenceChannel.presenceState();
                    state.onlineFriends = new Set(Object.keys(newState));
                    renderer.render();
                    renderer.renderDirectMessagesList();
                });

                presenceChannel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await presenceChannel.track({ online_at: new Date().toISOString() });
                    }
                });
            }

        } catch (error) {
            console.error('Initialization error:', error);
        }
    };

    init();
});