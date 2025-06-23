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

        async sendFriendRequestByUsername(username) {
            // ... (code for sending friend request)
        },
    };

    // --- 4. UI RENDERER ---
    const renderer = {
        renderFriendsList() {
            const { friends, onlineFriends } = state;
            const { onlineFriendsList, offlineFriendsList, onlineCount, offlineCount } = ui;

            onlineFriendsList.innerHTML = '';
            offlineFriendsList.innerHTML = '';

            const online = friends.filter(f => onlineFriends.has(f.id));
            const offline = friends.filter(f => !onlineFriends.has(f.id));

            onlineCount.textContent = online.length;
            offlineCount.textContent = offline.length;

            const createFriendHTML = (friend) => `
                <li class="dm-item" data-user-id="${friend.id}">
                    <div class="dm-item-avatar">
                        <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}'s avatar">
                        <div class="status-dot online"></div>
                    </div>
                    <span class="dm-item-name">${friend.username}</span>
                </li>`;

            online.forEach(friend => onlineFriendsList.innerHTML += createFriendHTML(friend));
            offline.forEach(friend => offlineFriendsList.innerHTML += createFriendHTML(friend));
        },
        renderPendingRequests() {
            const { pendingRequests } = state;
            const { pendingRequestsList, pendingCount, pendingSectionTitle } = ui;

            pendingRequestsList.innerHTML = '';
            pendingCount.textContent = pendingRequests.length;

            if (pendingRequests.length > 0) {
                pendingSectionTitle.style.display = 'block';
            } else {
                pendingSectionTitle.style.display = 'none';
            }

            const createRequestHTML = (request) => `
                <div class="friend-request-item" data-request-id="${request.id}">
                    <div class="request-info">
                        <img src="${request.avatarUrl || 'images/defaultavatar.png'}" alt="${request.username}'s avatar">
                        <span>${request.username}</span>
                    </div>
                    <div class="request-actions">
                        <button class="accept-btn"><i class="fas fa-check"></i></button>
                        <button class="reject-btn"><i class="fas fa-times"></i></button>
                    </div>
                </div>`;

            pendingRequests.forEach(req => pendingRequestsList.innerHTML += createRequestHTML(req));
        },
    };

    // --- 5. EVENT HANDLERS ---
    const handlePendingRequestAction = async (e) => {
        const acceptBtn = e.target.closest('.accept-btn');
        const rejectBtn = e.target.closest('.reject-btn');
        if (!acceptBtn && !rejectBtn) return;

        const requestItem = e.target.closest('.friend-request-item');
        if (!requestItem) return;

        const requestId = parseInt(requestItem.dataset.requestId, 10);

        // Kullanıcıya anında geri bildirim vermek için butonu devre dışı bırak
        if (acceptBtn) acceptBtn.disabled = true;
        if (rejectBtn) rejectBtn.disabled = true;

        let result;
        if (acceptBtn) {
            result = await supabaseService.acceptFriendRequest(requestId);
        } else {
            result = await supabaseService.rejectFriendRequest(requestId);
        }

        if (!result.success) {
            alert("İşlem sırasında bir hata oluştu. Lütfen sayfayı yenileyip tekrar deneyin.");
            // Başarısızlık durumunda butonları tekrar aktif et
            if (acceptBtn) acceptBtn.disabled = false;
            if (rejectBtn) rejectBtn.disabled = false;
        }
        // Başarılı olduğunda, real-time listener değişikliği yakalayıp UI'ı güncelleyecektir.
        // Bu yüzden burada ek bir UI güncellemesi yapmaya gerek yok.
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

        renderer.renderFriendsList();
        renderer.renderPendingRequests();
    }

    const init = async () => {
        state.currentUser = await supabaseService.getUserSession();
        if (!state.currentUser) return;

        // Sayfa ilk yüklendiğinde tüm verileri çek ve render et
        await fetchAndRenderAll();

        // `friendships` tablosundaki tüm değişiklikleri dinle
        supabase.channel('public:friendships')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, payload => {
                console.log('Friendship table change detected:', payload);
                // Değişiklik kiminle ilgili olursa olsun, mevcut kullanıcının listelerini yeniden çek ve render et.
                // Bu, hem istek gönderenin hem de alanın UI'ını günceller.
                fetchAndRenderAll();
            })
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    console.log('Successfully subscribed to real-time friendship changes!');
                }
            });

        // Mevcut online/offline ve broadcast kanallarını kaldırıyoruz.
        // Onların yerine daha basit ve merkezi bir yapı kurduk.

        ui.pendingRequestsList.addEventListener('click', handlePendingRequestAction);
        // ... other event listeners if any
    };

    init();
});